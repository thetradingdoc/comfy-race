import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PacketDecoder, encodeCommand } from '../lib/native.mjs';
import { MatrixRoom } from '../lib/room.mjs';

function packet(meta, bytes = Buffer.alloc(0)) {
  const text = Buffer.from(JSON.stringify(meta)), header = Buffer.alloc(8);
  header.writeUInt32BE(text.length); header.writeUInt32BE(bytes.length, 4);
  return Buffer.concat([header, text, bytes]);
}

/** Test double for native transport only; it deliberately has no movement/physics implementation. */
class FakeNative extends EventEmitter {
  constructor() {
    super(); this.calls = []; this.nextId = 1;
    this.state = { phase: 'lobby', host_id: 0, race_id: 0, epoch: 0, countdown: 0, route_id: 'downtown', routes: [{ id: 'downtown', name: 'Downtown', checkpoints: 4 }], players: [], ranking: [] };
  }
  async start() { return this.state; }
  async close() { this.closed = true; }
  async command(command, options) {
    this.calls.push({ ...command, options });
    let result = { ok: true };
    const player = this.state.players.find(item => item.id === command.player_id);
    if (command.type === 'join') {
      const id = this.nextId++, slot = this.state.players.length;
      this.state.players.push({ id, slot, name: command.name, connected: true, visible: true, ready: false, next: 0, elapsed: 0, penalty: 0, total: 0, finished: false, position: [100 + slot, 0, 200], heading: 0.5, speed: 0, input_seq: 0, notice: '' });
      if (!this.state.host_id) this.state.host_id = id;
      this.state.epoch++; result = { player_id: id, slot };
    } else if (command.type === 'ready') {
      assert.equal(command.epoch, this.state.epoch); assert.equal(command.race_id, this.state.race_id);
      player.ready = command.value;
      if (this.state.players.every(item => item.ready)) { this.state.phase = this.state.phase === 'paused' ? 'racing' : 'countdown'; this.state.race_id++; this.state.countdown = 3; }
    } else if (command.type === 'connected') {
      player.connected = command.value; player.visible = false;
      if (['racing', 'countdown', 'paused'].includes(this.state.phase)) { this.state.phase = 'paused'; this.state.epoch++; this.state.players.forEach(item => { item.ready = false; }); }
    } else if (command.type === 'focus') player.visible = command.value;
    else if (command.type === 'leave') { this.state.players = this.state.players.filter(item => item.id !== command.player_id); this.state.epoch++; this.state.host_id = this.state.players[0]?.id || 0; }
    else if (command.type === 'input') player.input_seq = command.seq;
    else if (command.type === 'end_race') this.state.phase = 'results';
    else if (command.type === 'next_race') { this.state.phase = 'lobby'; this.state.epoch++; this.state.players.forEach(item => { item.ready = false; item.finished = false; item.next = 0; }); }
    this.emit('state', this.state);
    return result;
  }
  async waitState(predicate) { assert.ok(predicate(this.state), 'Test transport did not reach expected native state'); return this.state; }
}

async function twoDrivers() {
  const native = new FakeNative(), room = new MatrixRoom({ code: 'RACE2', native });
  const host = await room.addPlayer({ name: 'Host' });
  const guest = await room.addPlayer({ name: 'Guest' });
  return { native, room, host, guest };
}

test('native IPC decoder handles fragmented JSON/media and concatenated packets', () => {
  const received = [], decoder = new PacketDecoder((meta, bytes) => received.push({ meta, bytes }));
  const bytes = packet({ type: 'frame', player_id: 2 }, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  for (let i = 0; i < bytes.length; i++) decoder.push(bytes.subarray(i, i + 1));
  decoder.push(Buffer.concat([packet({ type: 'state' }), packet({ type: 'reply', request: 'x' })]));
  assert.equal(received.length, 3);
  assert.deepEqual(received[0].bytes, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  assert.equal(received[2].meta.request, 'x');
  const command = encodeCommand({ type: 'input', seq: 7 });
  assert.equal(command.readUInt32BE(4), 0);
  assert.equal(JSON.parse(command.subarray(8)).seq, 7);
});

test('native IPC rejects unbounded media lengths before allocating a payload', () => {
  const header = Buffer.alloc(8); header.writeUInt32BE(2); header.writeUInt32BE(0xffffffff, 4);
  assert.throws(() => new PacketDecoder(() => {}).push(header), /Invalid native IPC/);
});

test('two ready human sessions and host permission are required before native start', async () => {
  const native = new FakeNative(), room = new MatrixRoom({ code: 'REAL2', native });
  const host = await room.addPlayer({ name: 'Host' });
  room.setReady(host.id, true);
  await assert.rejects(room.start(host.id), error => error.code === 'NEED_TWO_PLAYERS');
  const guest = await room.addPlayer({ name: 'Guest' });
  await assert.rejects(room.start(guest.id), error => error.code === 'HOST_ONLY');
  await assert.rejects(room.start(host.id), error => error.code === 'PLAYERS_NOT_READY');
  room.setReady(host.id, true); room.setReady(guest.id, true);
  assert.equal(native.calls.filter(call => call.type === 'ready').length, 0, 'UI ready cannot accidentally start the native game');
  await room.start(host.id);
  assert.equal(native.calls.filter(call => call.type === 'ready').length, 2);
  assert.equal(room.snapshot().phase, 'countdown');
  assert.equal(room.snapshot().engine, 'matrix');
  assert.equal(room.snapshot().aiActive, false);
});

test('input is bounded/sequenced and never accepts client positions or finish claims', async () => {
  const { room, native, host } = await twoDrivers();
  assert.equal(room.acceptInput(host.id, { seq: 0, steer: 9, throttle: 2, brake: -1, x: 999, finished: true }), true);
  assert.equal(room.acceptInput(host.id, { seq: 0, steer: 0, throttle: 0, brake: 0 }), false);
  const input = native.calls.find(call => call.type === 'input');
  assert.equal(input.steer, 1); assert.equal(input.throttle, 1); assert.equal(input.brake, 0); assert.equal(input.seq, 1);
  assert.equal('x' in input, false); assert.equal('finished' in input, false);
  assert.equal(room.snapshot().players[0].x, 100);
  assert.equal(room.snapshot().players[0].finished, false);
  assert.throws(() => room.acceptInput(host.id, { seq: 1, steer: NaN, throttle: 1, brake: 0 }), error => error.code === 'BAD_INPUT');
});

test('disconnect pauses native race; token reconnect preserves native input sequence and identity', async () => {
  const { room, native, host, guest } = await twoDrivers();
  room.setReady(host.id, true); room.setReady(guest.id, true); await room.start(host.id);
  room.acceptInput(guest.id, { seq: 8, steer: 0, throttle: 1, brake: 0 });
  await room.disconnect(guest.id);
  assert.equal(room.snapshot().phase, 'paused');
  await assert.rejects(room.reconnect('wrong-token'), error => error.code === 'INVALID_TOKEN');
  const reconnected = await room.reconnect(guest.token);
  assert.equal(reconnected.id, guest.id);
  room.acceptInput(guest.id, { seq: 0, steer: 0, throttle: 0, brake: 1 });
  assert.equal(native.calls.filter(call => call.type === 'input').at(-1).seq, 2);
  assert.ok(native.calls.some(call => call.type === 'connected' && call.value === false));
  assert.ok(native.calls.some(call => call.type === 'focus' && call.value === true));
});

test('results and route progress come from native scores, and reset clears readiness', async () => {
  const { room, native, host, guest } = await twoDrivers();
  const first = native.state.players[0], second = native.state.players[1];
  Object.assign(first, { next: 4, elapsed: 30, penalty: 5, total: 35, finished: true, position: [50, 1, 60] });
  Object.assign(second, { next: 4, elapsed: 32, penalty: 0, total: 32, finished: true });
  native.state.phase = 'results';
  assert.deepEqual(room.snapshot().results.map(player => player.id), [guest.id, host.id]);
  assert.equal(room.snapshot().results[0].finishTime, 32);
  assert.equal(room.snapshot().players[0].x, 50);
  assert.equal(room.snapshot().players[0].checkpoint, 4);
  await room.reset(host.id, 'tokyo');
  assert.equal(room.snapshot().phase, 'lobby');
  assert.equal(room.snapshot().city, 'tokyo');
  assert.equal(room.snapshot().locationMode, 'story-preset');
  assert.equal(room.snapshot().players.every(player => !player.ready), true);
  assert.equal(native.calls.at(-1).type, 'next_race');
});

test('video subscriptions open native streams only on request and return bounded credits', async () => {
  const { room, native, host } = await twoDrivers();
  await room.syncVideo(false);
  assert.equal(native.calls.some(call => call.type === 'video_start'), false);
  await room.syncVideo(true);
  assert.equal(native.calls.filter(call => call.type === 'video_start').length, 2);
  room.credit({ player_id: Number(host.id), media_generation: room.videoPlayers.get(host.id) });
  assert.equal(native.calls.at(-1).type, 'video_credit');
  assert.equal(native.calls.at(-1).count, 1);
  await room.syncVideo(false);
  assert.equal(native.calls.filter(call => call.type === 'video_stop').length, 2);
});

test('explicit leave releases native slots and ends active races; disconnect remains reconnectable', async () => {
  const { room, native, host, guest } = await twoDrivers();
  room.setReady(host.id, true); room.setReady(guest.id, true); await room.start(host.id);
  const result = await room.leave(guest.id);
  assert.equal(result.hostLeft, false);
  assert.equal(room.members.has(guest.id), false);
  assert.equal(native.state.players.length, 1);
  assert.deepEqual(native.calls.slice(-2).map(call => call.type), ['end_race', 'leave']);
  assert.equal(room.snapshot().phase, 'results');
  await room.reset(host.id);
  const newDriver = await room.addPlayer({ name: 'Replacement' });
  assert.notEqual(newDriver.id, guest.id);
  assert.equal(room.members.size, 2);
  const hostLeft = await room.leave(host.id);
  assert.equal(hostLeft.hostLeft, true);
});
