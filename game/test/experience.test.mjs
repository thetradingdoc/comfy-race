import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { EXPERIENCE_CAPABILITIES, validateExperienceManifest, experienceRecord } from '../lib/experience.mjs';
import { MatrixRoom } from '../lib/room.mjs';

const manifest = (overrides = {}) => ({
  schemaVersion: 1,
  id: 'nairobi-city-sprint',
  title: 'Nairobi City Sprint',
  cityTheme: 'nairobi',
  routeId: 'avenue',
  vehiclePresetId: 'matrix-street-default-v1',
  rulesPresetId: 'native-checkpoint-sprint',
  presentation: { style: 'motorsport', accent: '#20c997' },
  briefing: 'Two drivers. Follow every native checkpoint and deliver the fastest clean finish.',
  radio: { start: 'The city sprint is live.', checkpoint: 'Gate cleared. Keep your line.', finish: 'Finish recorded by the race engine.' },
  ...overrides,
});

/** Transport fixture only; no vehicle simulation or rendered gameplay is claimed. */
class ExperienceNative extends EventEmitter {
  constructor() {
    super(); this.calls = []; this.waits = 0; this.pending = null;
    this.state = {
      phase: 'lobby', host_id: 1, epoch: 4, race_id: 0, route_id: 'downtown',
      routes: ['downtown', 'avenue', 'skyway'].map(id => ({ id, checkpoints: 5 })),
      players: [1, 2].map((id, slot) => ({ id, slot, name: `Driver ${id}`, connected: true, visible: true, next: 0, elapsed: 0, penalty: 0, total: 0, finished: false, position: [slot * 4, 0, 0], heading: 0, speed: 0 })),
    };
  }
  async command(command) {
    this.calls.push(command);
    if (command.type === 'select_route' || command.type === 'next_race') this.pending = command;
    else if (command.type === 'end_race') this.state.phase = 'results';
    return { ok: true };
  }
  async waitState(predicate) {
    this.waits++;
    assert.equal(predicate(this.state), false, 'Operation accepted cached native state without an updated epoch');
    this.state.epoch++;
    this.state.phase = 'lobby';
    if (this.pending?.type === 'select_route') this.state.route_id = this.pending.route_id;
    this.pending = null;
    assert.equal(predicate(this.state), true);
    this.emit('state', this.state);
    return this.state;
  }
}

function roomFixture() {
  const native = new ExperienceNative(), room = new MatrixRoom({ code: 'PACK1', native });
  room.hostId = '1';
  for (const id of ['1', '2']) room.members.set(id, { id, name: `Driver ${id}`, connected: true, ready: true });
  return { native, room };
}

test('experience capabilities describe only implemented vehicle/rules and no generated geography', () => {
  assert.deepEqual(EXPERIENCE_CAPABILITIES.vehiclePresets.map(preset => preset.id), ['matrix-street-default-v1']);
  assert.equal(EXPERIENCE_CAPABILITIES.generatedPhysics, false);
  assert.equal(EXPERIENCE_CAPABILITIES.generatedMaps, false);
  assert.deepEqual(EXPERIENCE_CAPABILITIES.routeIds, ['downtown', 'avenue', 'skyway']);
});

test('manifest validator rejects unsupported Formula vehicles, routes, rules and hidden engine fields', () => {
  for (const input of [
    manifest({ vehiclePresetId: 'open-wheel-v1' }),
    manifest({ routeId: 'nairobi-grand-prix' }),
    manifest({ rulesPresetId: 'f1-eleven-laps' }),
    manifest({ physics: { mass: 800 } }),
    manifest({ map: 'generated-road.glb' }),
    manifest({ provenance: 'comfy' }),
    manifest({ presentation: { style: 'motorsport', accent: '#20c997', script: 'run()' } }),
    manifest({ radio: { start: '', checkpoint: '', finish: '', audioUrl: 'https://example.test' } }),
  ]) assert.throws(() => validateExperienceManifest(input), error => ['INVALID_EXPERIENCE', 'UNSUPPORTED_EXPERIENCE'].includes(error.code));
});

test('manifest validation bounds text/version/colour and returns immutable canonical data', () => {
  for (const input of [
    manifest({ schemaVersion: 2 }), manifest({ briefing: 'x'.repeat(401) }),
    manifest({ title: 'x'.repeat(101) }), manifest({ requestedStyle: 'x'.repeat(81) }),
    manifest({ radio: { start: 'x'.repeat(161), checkpoint: '', finish: '' } }),
    manifest({ presentation: { style: 'motorsport', accent: 'red' } }),
  ]) assert.throws(() => validateExperienceManifest(input), error => error.code === 'INVALID_EXPERIENCE');
  const input = manifest(), canonical = validateExperienceManifest(input);
  input.radio.start = 'Changed outside the validator';
  assert.equal(canonical.radio.start, 'The city sprint is live.');
  assert.equal(canonical.presentation.accent, '#20C997');
  assert.throws(() => { canonical.radio.start = 'Mutate frozen input'; }, TypeError);
});

test('Formula requests remain clearly labelled presentation and cannot claim generated provenance', () => {
  const record = experienceRecord(manifest({ requestedStyle: 'F1 open-wheel' }));
  assert.equal(record.vehiclePresetId, 'matrix-street-default-v1');
  assert.equal(record.source, 'imported workflow manifest');
  assert.match(record.sha256, /^[a-f0-9]{64}$/);
  assert.ok(record.warnings.some(warning => /standard Matrix road car/.test(warning)));
  assert.ok(record.warnings.some(warning => /descriptive only/.test(warning)));
});

test('host applies the same native route and frozen experience to both drivers after a fresh epoch', async () => {
  const { native, room } = roomFixture();
  const input = manifest({ cityTheme: 'tokyo' });
  await room.applyExperience('1', input);
  const snapshot = room.snapshot();
  assert.deepEqual(native.calls, [{ type: 'select_route', player_id: 1, route_id: 'avenue' }]);
  assert.equal(native.waits, 1);
  assert.equal(snapshot.routeId, 'avenue'); assert.equal(snapshot.city, 'tokyo');
  assert.equal(snapshot.mission.name, input.title);
  assert.equal(snapshot.mission.source, 'imported workflow manifest');
  assert.equal(snapshot.players.every(player => !player.ready), true);
  input.briefing = 'Changed after approval';
  assert.notEqual(snapshot.experience.briefing, input.briefing);
  assert.throws(() => { snapshot.experience.presentation.style = 'street'; }, TypeError);
});

test('foreign hosts, mid-race changes and repeated heat changes are rejected before native commands', async () => {
  const { native, room } = roomFixture();
  await assert.rejects(room.applyExperience('2', manifest()), error => error.code === 'HOST_ONLY');
  native.state.phase = 'racing';
  await assert.rejects(room.applyExperience('1', manifest()), error => error.code === 'EXPERIENCE_PHASE');
  assert.equal(native.calls.length, 0);
  native.state.phase = 'lobby';
  await room.applyExperience('1', manifest());
  await assert.rejects(room.applyExperience('1', manifest({ id: 'another-pack' })), error => error.code === 'EXPERIENCE_LOCKED');
  assert.equal(native.calls.length, 1);
  await room.reset('1');
  assert.equal(room.experience, null);
  await room.applyExperience('1', manifest({ id: 'another-pack' }));
  assert.equal(room.snapshot().experience.id, 'another-pack');
});

test('invalid manifests and a route absent from the running native world never reach IPC', async () => {
  const { native, room } = roomFixture();
  await assert.rejects(room.applyExperience('1', manifest({ vehiclePresetId: 'formula' })), error => error.code === 'UNSUPPORTED_EXPERIENCE');
  native.state.routes = [{ id: 'downtown', checkpoints: 5 }];
  await assert.rejects(room.applyExperience('1', manifest()), error => error.code === 'UNSUPPORTED_EXPERIENCE');
  assert.equal(native.calls.length, 0);
});
