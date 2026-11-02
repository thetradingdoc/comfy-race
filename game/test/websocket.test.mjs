import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { createRaceServer } from '../server.mjs';

// Synthetic native transport fixture; this test verifies the gateway, not C++ gameplay.
class TransportFixture extends EventEmitter {
  constructor() {
    super(); this.next = 1;
    this.state = { phase: 'lobby', host_id: 0, epoch: 0, race_id: 0, route_id: 'test', routes: [{ id: 'test', checkpoints: 3 }], players: [] };
  }
  async start() { return this.state; }
  async close() { this.closed = true; }
  async command(command) {
    let result = { ok: true };
    if (command.type === 'join') {
      const id = this.next++, slot = this.state.players.length;
      this.state.players.push({ id, slot, name: command.name, connected: true, visible: true, ready: false, next: 0, elapsed: 0, penalty: 0, total: 0, finished: false, position: [slot * 5, 0, 0], speed: 0, heading: 0, input_seq: 0 });
      this.state.epoch++; this.state.host_id ||= id;
      result = { player_id: id, slot };
    } else if (command.type === 'leave') {
      this.state.players = this.state.players.filter(player => player.id !== command.player_id);
      this.state.host_id = this.state.players[0]?.id || 0; this.state.epoch++;
    } else if (command.type === 'connected') {
      const player = this.state.players.find(item => item.id === command.player_id);
      if (player) player.connected = command.value;
    }
    this.emit('state', this.state); return result;
  }
  async waitState(predicate) { assert.ok(predicate(this.state)); return this.state; }
}

async function connect(url) {
  const socket = new WebSocket(url), messages = [], waiting = new Set();
  socket.on('message', raw => {
    const message = JSON.parse(raw.toString()); messages.push(message);
    for (const waiter of waiting) if (waiter.predicate(message)) { clearTimeout(waiter.timer); waiting.delete(waiter); waiter.resolve(message); }
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return {
    socket, messages, send: message => socket.send(JSON.stringify(message)),
    wait(predicate) {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => { const waiter = { predicate, resolve, timer: setTimeout(() => { waiting.delete(waiter); reject(new Error('Expected WebSocket message not received')); }, 2000) }; waiting.add(waiter); });
    },
  };
}

test('WebSocket rooms preserve phone HUD-only delivery and host leave releases the world immediately', async () => {
  const natives = [];
  const server = createRaceServer({ nativeFactory: () => { const native = new TransportFixture(); natives.push(native); return native; } });
  const address = await server.listen({ host: '127.0.0.1', port: 0 });
  const base = `http://127.0.0.1:${address.port}`;
  let display, phone;
  try {
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.engine, 'matrix'); assert.equal(status.aiActive, false);
    const invalidQr = await fetch(`${base}/api/qr?text=javascript:alert(1)`);
    assert.equal(invalidQr.status, 400);
    const qr = await fetch(`${base}/api/qr?text=${encodeURIComponent(`${base}/?room=TEST`)}`);
    assert.equal(qr.status, 200); assert.match(await qr.text(), /<svg/);
    display = await connect(base.replace('http', 'ws') + '/ws');
    phone = await connect(base.replace('http', 'ws') + '/ws');
    display.send({ type: 'subscribe', video: true });
    phone.send({ type: 'subscribe', video: false });
    display.send({ type: 'create', name: 'Display Driver' });
    const host = await display.wait(message => message.type === 'welcome');
    phone.send({ type: 'join', code: host.code, name: 'Phone Driver' });
    const guest = await phone.wait(message => message.type === 'welcome');
    assert.notEqual(host.playerId, guest.playerId);
    await display.wait(message => message.type === 'room' && message.players.length === 2);
    natives[0].emit('frame', { player_id: Number(guest.playerId), media_generation: 1, width: 800, height: 450, frame_id: 1 }, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const frame = await display.wait(message => message.type === 'frame');
    assert.equal(frame.playerId, guest.playerId); assert.equal(frame.renderer, 'matrix-native');
    await delay(30);
    assert.equal(phone.messages.some(message => message.type === 'frame'), false, 'Phone received an image payload');
    display.send({ type: 'leave' });
    await display.wait(message => message.type === 'left');
    await phone.wait(message => message.type === 'error' && message.code === 'ROOM_CLOSED');
    assert.equal(server.rooms.size, 0);
    assert.equal(natives[0].closed, true);
    display.send({ type: 'create', name: 'Second Room' });
    await display.wait(message => message.type === 'welcome' && message.code !== host.code);
    assert.equal(server.rooms.size, 1);
  } finally {
    display?.socket.terminate(); phone?.socket.terminate(); await server.close();
  }
});
