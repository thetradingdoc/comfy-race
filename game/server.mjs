import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { WebSocket, WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { NativeMatrix, inspectNative } from './lib/native.mjs';
import { MatrixRoom, fail } from './lib/room.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const json = (res, status, value) => { res.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
const send = (socket, value, limit = 256 * 1024) => { if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < limit) socket.send(JSON.stringify(value)); };

export function createRaceServer({ publicDir = process.env.PUBLIC_DIR || resolve(ROOT, 'public'), apiHandler, nativeFactory = config => new NativeMatrix(config), nativeConfig = {} } = {}) {
  const config = {
    binary: process.env.MATRIX_RACE_BIN || resolve(ROOT, '../resources/matrix-game/Matrix-Game-4/game/racing/bin/CitySampleRaceServer'),
    assets: process.env.MATRIX_RACE_ASSETS || resolve(ROOT, '../resources/racing'),
    width: Number(process.env.MATRIX_FRAME_WIDTH) || 800, height: Number(process.env.MATRIX_FRAME_HEIGHT) || 450,
    fps: Number(process.env.MATRIX_FRAME_FPS) || 24, ...nativeConfig,
  };
  const rooms = new Map(), clients = new Set();
  const maxPlayers = Math.max(2, Math.min(5, Number(process.env.MATRIX_RACE_MAX_PLAYERS) || 2));
  const broadcast = (room, type = 'room') => {
    const snapshot = room.snapshot();
    for (const client of clients) if (client.room === room) send(client.socket, { type, room: snapshot, players: snapshot.players });
  };
  const syncVideo = room => room.enqueue(() => room.syncVideo([...clients].some(client => client.room === room && client.video))).catch(error => { room.error = error.message; broadcast(room); });
  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (apiHandler && await apiHandler(req, res)) return;
      if (url.pathname === '/api/status') {
        const native = await inspectNative(config);
        const bound = httpServer.address();
        const lanEnabled = bound && typeof bound === 'object' && ['0.0.0.0', '::'].includes(bound.address);
        const interfaces = Object.entries(networkInterfaces()).sort(([a], [b]) => (a === 'en0' ? -1 : b === 'en0' ? 1 : a.localeCompare(b)));
        const networkUrls = lanEnabled ? interfaces.flatMap(([, addresses]) => (addresses || []).filter(a => !a.internal && a.family === 'IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)).map(a => `http://${a.address}:${bound.port}`)) : [];
        json(res, 200, { ok: true, app: 'Comfy Race', engine: 'matrix', engineMode: native.configured, engineConfigured: native.configured, engineActive: [...rooms.values()].some(room => Boolean(room.native.state) && !room.error && !room.closed), renderer: 'matrix-native', native, aiMode: false, aiActive: false, comfyConfigured: Boolean(process.env.COMFY_RACE_GPU_URL), story: 'authored', requiresCredits: false, maxPlayers, networkUrls, multiplayer: { authoritative: true, minPlayers: 2, maxPlayers, nativeCapacity: 5, capacityNote: 'Two human drivers are the default live configuration. Larger rooms require performance testing.', phones: 'controllers', bots: false, websocket: '/ws' }, rooms: rooms.size });
        return;
      }
      if (url.pathname === '/api/offer') { json(res, 503, { error: 'COMFY_UNCONFIGURED', message: 'Live Comfy rendering is not configured. Matrix native rendering remains separate.' }); return; }
      if (url.pathname === '/api/qr') {
        const text = url.searchParams.get('text') || '';
        let target;
        try { target = new URL(text); } catch { json(res, 400, { error: 'A valid join URL is required.' }); return; }
        if (text.length > 1024 || !['http:', 'https:'].includes(target.protocol)) { json(res, 400, { error: 'Use an HTTP join URL of at most 1024 characters.' }); return; }
        const svg = await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#102019', light: '#ffffff' } });
        res.writeHead(200, { 'content-type': MIME['.svg'], 'cache-control': 'no-store' }); res.end(svg); return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { json(res, 405, { error: 'Method not allowed.' }); return; }
      const base = resolve(publicDir);
      const path = decodeURIComponent(url.pathname);
      const relative = extname(path) ? path : '/index.html';
      const filePath = resolve(base, `.${relative}`);
      if (filePath !== base && !filePath.startsWith(`${base}${sep}`)) { json(res, 403, { error: 'Forbidden.' }); return; }
      try {
        if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
        const body = req.method === 'HEAD' ? null : await readFile(filePath);
        res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(body);
      } catch { json(res, 404, { error: 'File not found. Build the frontend into public/ or set PUBLIC_DIR.' }); }
    } catch { if (!res.headersSent) json(res, 500, { error: 'Request failed.' }); else res.end(); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  httpServer.on('upgrade', (req, socket, head) => {
    if ((req.url || '').split('?')[0] !== '/ws') { socket.destroy(); return; }
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) { socket.destroy(); return; } }
      catch { socket.destroy(); return; }
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  const newCode = () => {
    let code;
    do { code = [...randomBytes(5)].map(n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 31]).join(''); } while (rooms.has(code));
    return code;
  };
  wss.on('connection', socket => {
    const client = { socket, room: null, member: null, video: false, joining: false, messages: 0, windowStart: Date.now() };
    clients.add(client);
    const authTimer = setTimeout(() => { if (!client.room && !client.joining) socket.close(1008, 'Join a room first'); }, 45000);
    authTimer.unref();
    socket.on('message', async raw => {
      try {
        if (Date.now() - client.windowStart >= 1000) { client.windowStart = Date.now(); client.messages = 0; }
        if (++client.messages > 100) fail('TOO_MANY_MESSAGES', 'Too many requests.');
        const message = JSON.parse(raw.toString());
        if (!message || typeof message.type !== 'string') fail('BAD_MESSAGE', 'A message type is required.');
        if (message.type === 'subscribe') { client.video = message.video === true; if (client.room) syncVideo(client.room); return; }
        if (message.type === 'ping') { send(socket, { type: 'pong', timestamp: message.timestamp }); return; }
        if (['create', 'join', 'watch'].includes(message.type)) {
          if (client.room || client.joining) fail('ALREADY_JOINED', 'You are already joining a room. Reload to switch rooms.');
          client.joining = true;
          let room;
          try {
            if (message.type === 'create') {
              if (rooms.size >= 1) fail('SERVER_FULL', 'One Matrix world is running on this demo server. Join its room.');
              const native = nativeFactory(config);
              room = new MatrixRoom({ code: newCode(), native, city: message.city, maxPlayers });
              rooms.set(room.code, room);
              room.on('state', () => broadcast(room, 'state'));
              room.on('frame', (meta, bytes) => {
                // Keep phone controllers light: image packets only go to subscribed projector/laptop clients.
                const frame = { type: 'frame', playerId: String(meta.player_id), data: bytes.toString('base64'), mime: 'image/jpeg', width: meta.width, height: meta.height, frameId: meta.frame_id, inputSeq: meta.applied_input_seq, renderer: 'matrix-native' };
                for (const display of clients) if (display.room === room && display.video) send(display.socket, frame, 256 * 1024);
                room.credit(meta);
              });
              send(socket, { type: 'loading', message: 'Starting the Matrix City Racing native engine…' });
              try { await native.start(); } catch (error) { rooms.delete(room.code); await room.close(); fail('NATIVE_UNAVAILABLE', error.message); }
            } else {
              room = rooms.get(String(message.code || '').trim().toUpperCase());
              if (!room) fail('ROOM_NOT_FOUND', 'Room not found. Check the code or ask the host.');
              if (room.error) fail('NATIVE_UNAVAILABLE', room.error);
            }
            if (message.type !== 'watch') {
              if (socket.readyState !== WebSocket.OPEN) {
                if (message.type === 'create') { rooms.delete(room.code); await room.close(); }
                return;
              }
              const member = await room.enqueue(async () => {
                const joined = await (message.token ? room.reconnect(message.token) : room.addPlayer(message));
                joined.activeTransport = client;
                return joined;
              });
              if (socket.readyState !== WebSocket.OPEN) {
                await room.enqueue(() => member.activeTransport === client ? room.leave(member.id) : undefined);
                if (!room.members.size) { rooms.delete(room.code); await room.close(); }
                return;
              }
              // Reconnection replaces its old transport without letting that close disconnect the new one.
              const old = [...clients].find(other => other !== client && other.member === member);
              if (old) { old.member = null; old.room = null; old.socket.close(1000, 'Reconnected elsewhere'); }
              client.member = member; client.room = room;
              send(socket, { type: 'welcome', playerId: member.id, token: member.token, code: room.code });
            } else { client.room = room; send(socket, { type: 'welcome', spectator: true, code: room.code }); }
            clearTimeout(authTimer);
            broadcast(room); syncVideo(room);
          } finally { client.joining = false; }
          return;
        }
        if (!client.room || !client.member) fail('NOT_JOINED', 'Join as a driver first.');
        const room = client.room, id = client.member.id;
        if (client.member.activeTransport !== client) fail('REPLACED_CONNECTION', 'This driver reconnected on another transport.');
        if (message.type === 'input') { room.acceptInput(id, message); return; }
        if (message.type === 'leave') {
          let result;
          try { result = await room.enqueue(() => room.leave(id)); }
          catch (error) {
            // The host can always close a failed native world and start again.
            if (id !== room.hostId && !room.error) throw error;
            result = { hostLeft: true, empty: true };
          }
          client.member = null; client.room = null;
          send(socket, { type: 'left', code: room.code });
          if (result.hostLeft || result.empty) {
            rooms.delete(room.code);
            for (const other of clients) if (other.room === room) {
              send(other.socket, { type: 'error', code: 'ROOM_CLOSED', message: 'The host ended this room. Create or join a new race.' });
              other.member = null; other.room = null;
            }
            await room.close();
          } else { broadcast(room); syncVideo(room); }
          return;
        }
        await room.enqueue(async () => {
          switch (message.type) {
            case 'ready': room.setReady(id, message.ready); break;
            case 'start': await room.start(id); break;
            case 'reset': await room.reset(id, message.city, message.routeId); break;
            case 'recover': await room.recover(id); break;
            default: fail('UNKNOWN_MESSAGE', 'Unknown action.');
          }
        });
        broadcast(room);
      } catch (error) { send(socket, { type: 'error', code: error.code || 'NATIVE_COMMAND', message: error.code || error.message ? error.message : 'Invalid message.' }); }
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      clearTimeout(authTimer); clients.delete(client);
      if (client.room && client.member) {
        const room = client.room, id = client.member.id;
        room.enqueue(() => room.members.get(id)?.activeTransport === client ? room.disconnect(id) : undefined).then(() => { if (!room.closed) { broadcast(room); syncVideo(room); } }).catch(error => { if (!room.closed) { room.error = error.message; broadcast(room); } });
      } else if (client.room) syncVideo(client.room);
    });
  });
  const cleanup = setInterval(() => {
    for (const [code, room] of rooms) if (Date.now() - room.lastActive > 120000 && ![...clients].some(client => client.room === room)) {
      rooms.delete(code); room.close().catch(() => {});
    }
  }, 15000);
  cleanup.unref();
  return {
    httpServer, wss, rooms,
    async listen({ host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 8090) } = {}) {
      await new Promise((resolveListen, reject) => { httpServer.once('error', reject); httpServer.listen(port, host, resolveListen); });
      return httpServer.address();
    },
    async close() {
      clearInterval(cleanup);
      for (const client of clients) client.socket.terminate();
      await Promise.all([...rooms.values()].map(room => room.close()));
      await new Promise(resolveClose => wss.close(resolveClose));
      if (httpServer.listening) await new Promise(resolveClose => httpServer.close(resolveClose));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let apiHandler;
  try { const { handleComfyRequest } = await import('./lib/comfy.mjs'); apiHandler = (req, res) => handleComfyRequest(req, res, { gpuUrl: process.env.COMFY_RACE_GPU_URL, token: process.env.COMFY_RACE_GPU_TOKEN, operatorToken: process.env.COMFY_RACE_OPERATOR_TOKEN }); }
  catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
  const game = createRaceServer({ apiHandler });
  const address = await game.listen();
  console.log(`Comfy Race (Matrix native): http://${address.address === '0.0.0.0' ? 'localhost' : address.address}:${address.port}`);
  console.log('Phone controllers use the same host. Comfy live rendering is a separate optional connection.');
  const shutdown = async () => { await game.close(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
