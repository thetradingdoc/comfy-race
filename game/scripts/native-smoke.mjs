/** Explicit native integration smoke. Run with MATRIX_RACE_BIN, MATRIX_RACE_ASSETS.
 * Uses two automated test sessions to check independent controls, not a completed human race.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { NativeMatrix } from '../lib/native.mjs';
import { MatrixRoom } from '../lib/room.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const binary = process.env.MATRIX_RACE_BIN || resolve(projectRoot, 'resources/matrix-game/Matrix-Game-4/game/racing/bin/CitySampleRaceServer');
const assets = process.env.MATRIX_RACE_ASSETS || resolve(projectRoot, 'resources/racing');
const native = new NativeMatrix({ binary, assets, width: 800, height: 450, fps: 24 });
const room = new MatrixRoom({ code: 'SMOKE', native });
const firstFrames = new Map(), counts = new Map();
let lastFailure;
native.on('failure', error => { lastFailure = error; });
native.on('frame', (meta, bytes) => {
  const id = String(meta.player_id);
  if (!firstFrames.has(id)) firstFrames.set(id, Buffer.from(bytes));
  counts.set(id, (counts.get(id) || 0) + 1);
  room.credit(meta);
});
const position = id => native.state.players.find(player => String(player.id) === id).position;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
let sequence = 0;
async function drive(first, second, controlsFirst, controlsSecond, duration = 1500) {
  const end = Date.now() + duration;
  while (Date.now() < end) {
    sequence++;
    room.acceptInput(first.id, { seq: sequence, steer: 0, brake: 0, throttle: 0, ...controlsFirst });
    room.acceptInput(second.id, { seq: sequence, steer: 0, brake: 0, throttle: 0, ...controlsSecond });
    await delay(40);
    if (lastFailure) throw lastFailure;
  }
  await delay(150);
}

try {
  await native.start();
  const first = await room.addPlayer({ name: 'Native Test A' });
  const second = await room.addPlayer({ name: 'Native Test B' });
  assert.notEqual(first.id, second.id);
  await room.syncVideo(true);
  room.setReady(first.id, true); room.setReady(second.id, true);
  await room.start(first.id);
  await native.waitState(state => state.phase === 'racing', 6500);
  const firstStart = [...position(first.id)], secondStart = [...position(second.id)];
  await drive(first, second, { throttle: 1 }, { throttle: 0, brake: 1 });
  const firstDistance = distance(firstStart, position(first.id));
  const parkedDistance = distance(secondStart, position(second.id));
  assert.ok(firstDistance > 2, `First native car did not move: ${firstDistance} m`);
  assert.ok(parkedDistance < 1, `Braked second native car moved unexpectedly: ${parkedDistance} m`);
  const secondBefore = [...position(second.id)];
  await drive(first, second, { throttle: 0, brake: 1 }, { throttle: 1 });
  const secondDistance = distance(secondBefore, position(second.id));
  assert.ok(secondDistance > 2, `Second native car did not move independently: ${secondDistance} m`);
  assert.ok(firstFrames.has(first.id) && firstFrames.has(second.id), 'Actual JPEG frames missing for one native view');
  for (const bytes of firstFrames.values()) assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
  await room.disconnect(second.id);
  await native.waitState(state => state.phase === 'paused');
  const pausedPosition = [...position(first.id)];
  await delay(250);
  assert.ok(distance(pausedPosition, position(first.id)) < 0.001, 'Native world advanced while paused');
  await room.reconnect(second.token);
  room.setReady(first.id, true); room.setReady(second.id, true);
  await room.start(first.id);
  await native.waitState(state => state.phase === 'racing');
  await room.reset(first.id);
  assert.equal(room.snapshot().phase, 'lobby');
  const departure = await room.leave(second.id);
  assert.equal(departure.hostLeft, false);
  assert.equal(native.state.players.length, 1);
  const hostDeparture = await room.leave(first.id);
  assert.equal(hostDeparture.empty, true);
  const report = {
    checkedAt: new Date().toISOString(), engine: 'actual Matrix City Racing C++',
    sessions: [first.id, second.id], nativeIndependentMovementMeters: { first: firstDistance, second: secondDistance, parkedSecond: parkedDistance },
    framesByPlayer: Object.fromEntries(counts), size: '800x450', targetFps: 24,
    checks: ['two distinct native slots', 'independent throttle/brake movement', 'real JPEG views for both slots', 'disconnect freezes native world', 'token reconnect and all-ready resume', 'host end/reset', 'explicit leave releases native slots'],
    limitation: 'Automated integration smoke only; no complete human-driven course, phone/LAN, audio or Comfy GPU verification.',
  };
  if (process.env.EVIDENCE_DIR) {
    const directory = resolve(process.env.EVIDENCE_DIR); await mkdir(directory, { recursive: true });
    for (const [id, bytes] of firstFrames) await writeFile(resolve(directory, `matrix-native-player-${id}.jpg`), bytes);
    await writeFile(resolve(directory, 'native-multiplayer-smoke.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await room.close(); }
