import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';

const MAX_JSON = 1024 * 1024;
const MAX_MEDIA = 16 * 1024 * 1024;

/** Native Matrix IPC is an 8-byte network-order header, JSON, then optional media. */
export function encodeCommand(command) {
  const json = Buffer.from(JSON.stringify(command));
  if (json.length > 65536) throw new Error('Native command is too large.');
  const header = Buffer.alloc(8);
  header.writeUInt32BE(json.length, 0);
  return Buffer.concat([header, json]);
}

export class PacketDecoder {
  constructor(onPacket) { this.buffer = Buffer.alloc(0); this.onPacket = onPacket; }
  push(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (this.buffer.length >= 8) {
      const jsonLength = this.buffer.readUInt32BE(0), mediaLength = this.buffer.readUInt32BE(4);
      if (!jsonLength || jsonLength > MAX_JSON || mediaLength > MAX_MEDIA) throw new Error('Invalid native IPC packet size.');
      const length = 8 + jsonLength + mediaLength;
      if (this.buffer.length < length) break;
      const meta = JSON.parse(this.buffer.subarray(8, 8 + jsonLength).toString('utf8'));
      const media = this.buffer.subarray(8 + jsonLength, length);
      this.buffer = this.buffer.subarray(length);
      this.onPacket(meta, media);
    }
  }
}

export async function inspectNative({ binary, assets }) {
  try {
    await access(binary, constants.X_OK);
    await access(`${assets}/assets/bbox-assets.bin`, constants.R_OK);
    await access(`${assets}/assets/race-routes.json`, constants.R_OK);
    return { configured: true, binary, assets };
  } catch {
    return { configured: false, binary, assets, message: 'Build the Matrix race server and download its racing assets. Set MATRIX_RACE_BIN and MATRIX_RACE_ASSETS.' };
  }
}

/** Runs the actual upstream Matrix C++ server. This module contains no game simulation. */
export class NativeMatrix extends EventEmitter {
  constructor(config) {
    super(); this.config = config; this.child = null; this.state = null;
    this.pending = new Map(); this.lastError = ''; this.closed = false;
  }
  async start() {
    const readiness = await inspectNative(this.config);
    if (!readiness.configured) throw new Error(readiness.message);
    const { binary, assets, width = 800, height = 450, fps = 24 } = this.config;
    const env = { ...process.env };
    if (process.platform === 'darwin') delete env.CITYSAMPLE_EGL;
    // On Unix, Node's extra stdio 'pipe' is a duplex, blocking child-side socketpair.
    // Native Channel uses recv/send, so a one-way POSIX pipe is unsuitable.
    this.child = spawn(binary, ['--data-dir', assets, '--ipc-fd', '3', '--width', String(width), '--height', String(height), '--fps', String(fps), '--codec', 'jpeg', '--traffic', '16', '--pedestrians', '20', '--encoder-threads', '1'], {
      stdio: ['ignore', 'pipe', 'pipe', 'pipe'], env,
    });
    const decoder = new PacketDecoder((meta, media) => {
      if (meta.type === 'hello') { this.state = meta.state; this.emit('hello', meta); this.emit('state', this.state); }
      else if (meta.type === 'state') { this.state = meta; this.emit('state', meta); }
      else if (meta.type === 'reply') {
        const request = this.pending.get(meta.request);
        if (request) { clearTimeout(request.timer); this.pending.delete(meta.request); meta.error ? request.reject(new Error(meta.error)) : request.resolve(meta.result); }
      } else if (meta.type === 'frame') this.emit('frame', meta, media);
      else this.emit('packet', meta, media);
    });
    this.child.stdio[3].on('data', chunk => {
      try { decoder.push(chunk); } catch (error) { this.fail(error); this.child.kill('SIGTERM'); }
    });
    this.child.stdio[3].on('error', error => this.fail(error));
    this.child.stdout.on('data', () => {}); // Upstream diagnostics never share the framed IPC channel.
    this.child.stderr.on('data', chunk => { this.lastError = `${this.lastError}${chunk.toString()}`.slice(-4000); this.emit('log', chunk.toString()); });
    this.child.on('error', error => this.fail(error));
    this.child.on('exit', (code, signal) => {
      if (!this.closed) {
        const message = /video driver did not add any displays|No available video device/i.test(this.lastError)
          ? 'Matrix cannot access the macOS display from this process. Run "Run Comfy Race.command" directly from your desktop, then create a room again.'
          : `Matrix engine stopped (${signal || code}). ${this.lastError.trim().slice(-600)}`;
        this.fail(new Error(message));
      }
      this.emit('exit', code, signal);
    });
    await new Promise((resolveHello, reject) => {
      if (this.state) { resolveHello(); return; }
      const done = () => { clearTimeout(timer); this.off('hello', hello); this.off('failure', failure); };
      const hello = () => { done(); resolveHello(); };
      const failure = error => { done(); reject(error); };
      const timer = setTimeout(() => { done(); this.child.kill('SIGTERM'); reject(new Error('Matrix engine did not become ready in 30 seconds.')); }, 30000);
      this.once('hello', hello); this.once('failure', failure);
    });
    return this.state;
  }
  fail(error) {
    this.lastError = error.message;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
    this.pending.clear(); this.emit('failure', error);
  }
  command(command, { noReply = false } = {}) {
    if (!this.child || this.child.killed || this.closed) return Promise.reject(new Error('Matrix engine is unavailable.'));
    if (noReply) {
      // A congested IPC socket drops superseded controls; native stale-input braking remains authoritative.
      if (command.type === 'input' && this.child.stdio[3].writableLength > 65536) return Promise.resolve({ dropped: true });
      this.child.stdio[3].write(encodeCommand({ ...command, no_reply: true }));
      return Promise.resolve({ ok: true });
    }
    const request = randomUUID();
    return new Promise((resolveCommand, reject) => {
      const timer = setTimeout(() => { this.pending.delete(request); reject(new Error(`Matrix ${command.type} timed out.`)); }, 8000);
      this.pending.set(request, { resolve: resolveCommand, reject, timer });
      this.child.stdio[3].write(encodeCommand({ ...command, request }));
    });
  }
  waitState(predicate, timeout = 2500) {
    if (this.state && predicate(this.state)) return Promise.resolve(this.state);
    return new Promise((resolveState, reject) => {
      const finish = () => { clearTimeout(timer); this.off('state', listener); this.off('failure', failure); };
      const listener = state => { if (predicate(state)) { finish(); resolveState(state); } };
      const failure = error => { finish(); reject(error); };
      const timer = setTimeout(() => { finish(); reject(new Error('Waiting for fresh Matrix state timed out.')); }, timeout);
      this.on('state', listener); this.once('failure', failure);
    });
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('Matrix session closed.')); }
    this.pending.clear();
    if (!this.child || this.child.exitCode !== null) return;
    await new Promise(resolveExit => {
      const hardKill = setTimeout(() => this.child.kill('SIGKILL'), 1500);
      this.child.once('exit', () => { clearTimeout(hardKill); resolveExit(); });
      this.child.stdio[3].destroy(); this.child.kill('SIGTERM');
    });
  }
}
