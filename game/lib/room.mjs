import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { experienceRecord } from './experience.mjs';

const PALETTE = ['#61e6ad', '#ff8a63', '#a891ff', '#60c8ff', '#ffcf69'];
export const CITIES = {
  nairobi: { name: 'Nairobi', title: 'Nairobi Rush', briefing: 'A midnight courier relay. Follow the native city course, collect the dispatch at the first gate, then deliver it before the finish.' },
  tokyo: { name: 'Tokyo', title: 'Neon Relay', briefing: 'Follow the native city course and carry the relay dispatch through every gate.' },
  'new-york': { name: 'New York', title: 'Midnight Dispatch', briefing: 'Cross the native city course in the midnight courier relay.' },
  london: { name: 'London', title: 'Night Courier', briefing: 'Carry the courier dispatch through every gate on the native city course.' },
  moscow: { name: 'Moscow', title: 'Winter Relay', briefing: 'Complete the relay through every gate on the native city course.' },
};
export const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
export function safeName(name) {
  let value = String(name || 'Driver').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || 'Driver';
  while (Buffer.byteLength(value) > 64) value = value.slice(0, -1);
  return value;
}
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

/** Session permissions and UI normalization only. All motion, gates, scoring and collisions are native. */
export class MatrixRoom extends EventEmitter {
  constructor({ code, native, city = 'nairobi', maxPlayers = 2 }) {
    super(); this.code = code; this.native = native;
    this.city = Object.hasOwn(CITIES, city) ? city : 'nairobi';
    this.maxPlayers = maxPlayers; this.members = new Map(); this.videoPlayers = new Map();
    this.hostId = null; this.error = null; this.starting = false; this.closed = false;
    this.experience = null;
    this.createdAt = Date.now(); this.lastActive = Date.now(); this.queue = Promise.resolve();
    this.native.on('state', state => {
      if (state.phase === 'paused' && this.previousPhase !== 'paused') for (const member of this.members.values()) member.ready = false;
      this.previousPhase = state.phase;
      if (state.host_id) this.hostId = String(state.host_id);
      this.emit('state', this.snapshot());
    });
    this.native.on('frame', (meta, bytes) => this.emit('frame', meta, bytes));
    this.native.on('failure', error => { this.error = error.message; this.emit('state', this.snapshot()); });
  }
  enqueue(action) {
    const next = this.queue.then(action);
    this.queue = next.catch(() => {});
    return next;
  }
  requireHost(id) { if (id !== this.hostId) fail('HOST_ONLY', 'Only the host can do that.'); }
  epoch() { return { race_id: this.native.state?.race_id ?? 0, epoch: this.native.state?.epoch ?? 0 }; }
  async addPlayer({ name, color } = {}) {
    if (this.members.size >= this.maxPlayers) fail('ROOM_FULL', `This live room supports ${this.maxPlayers} human drivers.`);
    if (this.native.state?.phase !== 'lobby') fail('RACE_STARTED', 'Wait for the host to restart this race before joining.');
    const oldEpoch = this.native.state.epoch;
    const result = await this.native.command({ type: 'join', name: safeName(name), visible: true });
    const id = String(result.player_id);
    const member = { id, token: randomBytes(24).toString('base64url'), name: safeName(name), color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : PALETTE[result.slot], connected: true, ready: false, seq: -1, nativeSeq: 0, carIndex: result.slot };
    this.members.set(id, member);
    if (!this.hostId) this.hostId = id;
    for (const player of this.members.values()) player.ready = false;
    await this.native.waitState(state => state.epoch > oldEpoch && state.players.some(player => String(player.id) === id));
    this.lastActive = Date.now();
    return member;
  }
  async reconnect(token) {
    const member = [...this.members.values()].find(player => player.token === token);
    if (!member) fail('INVALID_TOKEN', 'Saved driver could not be reconnected. Join the room again.');
    const oldEpoch = this.native.state?.epoch ?? 0;
    const expectedEpoch = ['paused', 'racing', 'countdown'].includes(this.native.state?.phase) ? oldEpoch + 1 : oldEpoch;
    await this.native.command({ type: 'connected', player_id: Number(member.id), value: true });
    await this.native.command({ type: 'focus', player_id: Number(member.id), value: true });
    await this.native.waitState(state => state.epoch >= expectedEpoch && state.players.some(player => String(player.id) === member.id && player.connected && player.visible));
    member.connected = true; member.ready = false; member.seq = -1;
    member.nativeSeq = Math.max(member.nativeSeq, this.native.state?.players.find(player => String(player.id) === member.id)?.input_seq || 0);
    this.lastActive = Date.now();
    return member;
  }
  async disconnect(id) {
    const member = this.members.get(id);
    if (!member || !member.connected) return;
    member.connected = false; member.ready = false;
    this.lastActive = Date.now();
    await this.native.command({ type: 'connected', player_id: Number(id), value: false });
  }
  async leave(id) {
    const member = this.members.get(id);
    if (!member) return { hostLeft: false, empty: this.members.size === 0 };
    const hostLeft = id === this.hostId;
    // A deliberate departure ends an active race before removing the native slot.
    // A temporary transport loss uses disconnect() instead and remains reconnectable.
    if (!this.error && !this.native.closed) {
      if (!['lobby', 'results'].includes(this.native.state?.phase)) {
        await this.native.command({ type: 'end_race', player_id: Number(this.hostId) });
      }
      await this.native.command({ type: 'leave', player_id: Number(id) });
      await this.native.waitState(state => !state.players.some(player => String(player.id) === id));
    }
    this.members.delete(id); this.videoPlayers.delete(id);
    for (const player of this.members.values()) player.ready = false;
    this.lastActive = Date.now();
    return { hostLeft, empty: this.members.size === 0 };
  }
  setReady(id, ready = true) {
    const phase = this.native.state?.phase;
    if (!['lobby', 'paused'].includes(phase) || this.starting) fail('RACE_STARTED', 'Ready is available in the lobby or while paused.');
    const member = this.members.get(id);
    if (!member?.connected) fail('NOT_JOINED', 'Join the room first.');
    member.ready = Boolean(ready);
  }
  async start(id) {
    this.requireHost(id);
    if (!['lobby', 'paused'].includes(this.native.state?.phase)) fail('RACE_STARTED', 'Restart the room before another race.');
    if (this.experience && this.native.state.route_id !== this.experience.routeId) fail('EXPERIENCE_MISMATCH', 'The native route no longer matches the approved experience. Reset the room.');
    const members = [...this.members.values()];
    if (members.filter(player => player.connected).length < 2) fail('NEED_TWO_PLAYERS', 'Two connected human drivers are required. Share the room QR code.');
    if (members.some(player => !player.connected || !player.ready)) fail('PLAYERS_NOT_READY', 'Every driver must reconnect and confirm ready.');
    this.starting = true; this.emit('state', this.snapshot());
    try {
      const oldRace = this.native.state.race_id, oldPhase = this.native.state.phase;
      for (const member of members) await this.native.command({ type: 'ready', player_id: Number(member.id), value: true, ...this.epoch() });
      await this.native.waitState(state => oldPhase === 'lobby' ? state.race_id > oldRace : state.phase !== 'paused');
      for (const member of members) member.ready = false;
    } finally { this.starting = false; }
    this.lastActive = Date.now();
  }
  async reset(id, city, routeId) {
    this.requireHost(id);
    const player_id = Number(id), oldEpoch = this.native.state?.epoch ?? 0;
    if (!['lobby', 'results'].includes(this.native.state?.phase)) await this.native.command({ type: 'end_race', player_id });
    await this.native.command({ type: 'next_race', player_id });
    if (routeId) await this.native.command({ type: 'select_route', player_id, route_id: routeId });
    for (const member of this.members.values()) { member.ready = false; member.seq = -1; }
    await this.native.waitState(state => state.phase === 'lobby' && state.epoch > oldEpoch && (!routeId || state.route_id === routeId));
    if (Object.hasOwn(CITIES, city || '')) this.city = city;
    this.experience = null;
    this.lastActive = Date.now();
  }
  async applyExperience(id, input) {
    this.requireHost(id);
    if (this.closed || this.error) fail('NATIVE_UNAVAILABLE', 'The native world is unavailable. Create a new room.');
    if (this.native.state?.phase !== 'lobby' || this.starting) fail('EXPERIENCE_PHASE', 'Apply an experience in the lobby before countdown.');
    if (this.experience) fail('EXPERIENCE_LOCKED', 'This experience is frozen for the heat. Reset the room before choosing another.');
    const experience = experienceRecord(input);
    if (!this.native.state.routes?.some(route => route.id === experience.routeId)) fail('UNSUPPORTED_EXPERIENCE', 'The requested route is not loaded in this native world.');
    const oldEpoch = this.native.state.epoch;
    for (const member of this.members.values()) member.ready = false;
    await this.native.command({ type: 'select_route', player_id: Number(id), route_id: experience.routeId });
    await this.native.waitState(state => state.phase === 'lobby' && state.epoch > oldEpoch && state.route_id === experience.routeId);
    this.experience = experience;
    this.city = experience.cityTheme;
    this.lastActive = Date.now();
    return experience;
  }
  async recover(id) {
    await this.native.command({ type: 'recover', player_id: Number(id), request_id: randomBytes(12).toString('hex'), ...this.epoch() });
  }
  acceptInput(id, message) {
    const member = this.members.get(id);
    if (!member?.connected) fail('NOT_JOINED', 'Join the room first.');
    if (!Number.isSafeInteger(message.seq) || message.seq < 0) fail('BAD_INPUT', 'A non-negative input sequence is required.');
    if (message.seq <= member.seq) return false;
    for (const field of ['steer', 'throttle', 'brake']) if (typeof message[field] !== 'number' || !Number.isFinite(message[field])) fail('BAD_INPUT', 'Controls must be finite numbers.');
    member.seq = message.seq; member.nativeSeq++;
    this.native.command({ type: 'input', player_id: Number(id), seq: member.nativeSeq, ...this.epoch(), steer: clamp(message.steer, -1, 1), throttle: clamp(message.throttle, -1, 1), brake: clamp(message.brake, 0, 1), handbrake: message.handbrake ? 1 : 0 }, { noReply: true }).catch(error => { this.error = error.message; });
    return true;
  }
  async syncVideo(enabled) {
    const desired = enabled ? [...this.members.values()].filter(player => player.connected).map(player => player.id) : [];
    for (const [id, generation] of this.videoPlayers) if (!desired.includes(id)) {
      // A disconnected native player cannot receive media commands; its view is already disabled.
      if (this.members.get(id)?.connected) await this.native.command({ type: 'video_stop', player_id: Number(id), generation });
      this.videoPlayers.delete(id);
    }
    for (const id of desired) if (!this.videoPlayers.has(id)) {
      const generation = Date.now();
      await this.native.command({ type: 'video_start', player_id: Number(id), generation, capacity: 2 });
      this.videoPlayers.set(id, generation);
    }
  }
  credit(meta) {
    this.native.command({ type: 'video_credit', player_id: meta.player_id, generation: meta.media_generation, count: 1 }, { noReply: true }).catch(() => {});
  }
  snapshot() {
    const state = this.native.state || { phase: 'starting', players: [], routes: [] };
    const route = state.routes?.find(item => item.id === state.route_id);
    const checkpointCount = route?.checkpoints || 1;
    const members = state.players.map(player => {
      const id = String(player.id), member = this.members.get(id);
      const stage = player.finished ? 3 : player.next === 0 ? 0 : player.next >= Math.max(2, checkpointCount - 1) ? 2 : 1;
      const objectives = ['Reach the dispatch pickup gate', 'Dispatch collected — follow the route', 'Reach the delivery gate', 'Dispatch delivered — race complete'];
      return {
        id, name: member?.name || player.name, color: member?.color || PALETTE[player.slot],
        carIndex: player.slot, connected: member ? member.connected && player.connected : player.connected,
        ready: Boolean(member?.ready), isHost: id === this.hostId,
        x: player.position[0], z: player.position[2], heading: player.heading, speed: player.speed,
        lap: 1, checkpoint: player.next, checkpointCount, progress: player.next,
        finished: player.finished, finishTime: player.finished ? player.total : null,
        penalty: player.penalty, elapsed: player.elapsed, notice: player.notice,
        dnf: state.phase === 'results' && !player.finished,
        carrying: stage === 1 || stage === 2, deliveries: player.finished ? 1 : 0, missionStage: stage,
        objective: objectives[stage], nativeInputSeq: player.input_seq,
      };
    });
    const ranked = [...members].sort((a, b) => a.finished !== b.finished ? a.finished ? -1 : 1 : a.finished ? a.finishTime - b.finishTime : b.checkpoint - a.checkpoint || (a.elapsed + a.penalty) - (b.elapsed + b.penalty));
    ranked.forEach((player, index) => { player.rank = index + 1; });
    return {
      code: this.code, phase: this.error ? 'error' : this.starting ? 'starting' : state.phase,
      hostId: this.hostId, city: this.city, cityName: CITIES[this.city].name,
      locationMode: 'story-preset', map: 'Matrix CitySample native city',
      mission: this.experience ? { id: this.experience.id, source: this.experience.source, name: this.experience.title, briefing: this.experience.briefing } : { id: `${this.city}-authored-v1`, source: 'authored', name: CITIES[this.city].title, briefing: CITIES[this.city].briefing },
      experience: this.experience,
      laps: 1, routeId: state.route_id, routes: state.routes, checkpointCount,
      raceId: state.race_id, epoch: state.epoch, countdown: state.countdown || 0,
      elapsed: Math.max(0, ...members.map(player => player.elapsed)), remaining: null,
      pauseReason: state.pause_reason || '', players: members,
      results: state.phase === 'results' ? ranked.map(player => ({ id: player.id, name: player.name, color: player.color, rank: player.rank, finished: player.finished, dnf: player.dnf, finishTime: player.finishTime, penalty: player.penalty, deliveries: player.deliveries, progress: player.progress })) : [],
      engine: 'matrix', renderer: 'matrix-native', aiActive: false, maxPlayers: this.maxPlayers,
      error: this.error,
    };
  }
  async close() { this.closed = true; await this.native.close(); }
}
