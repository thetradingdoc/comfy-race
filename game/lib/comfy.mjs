import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAX_BODY = 1_500_000;
const reply = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};

export function validateGpuUrl(value = '') {
  if (!value) return '';
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || u.pathname !== '/') {
    throw new Error('COMFY_RACE_GPU_URL must be an HTTP(S) origin without credentials, path, query or fragment');
  }
  return u.origin;
}

export function validateOffer(payload) {
  const { offer, prompts, resolution } = payload || {};
  if (offer?.type !== 'offer' || typeof offer.sdp !== 'string' || !offer.sdp.startsWith('v=0') || offer.sdp.length > 120_000) {
    throw new Error('Expected a valid WebRTC SDP offer');
  }
  if (!Array.isArray(prompts) || prompts.length !== 1 || !prompts[0] || typeof prompts[0] !== 'object' || Array.isArray(prompts[0])) {
    throw new Error('Exactly one ComfyUI API-format workflow is required');
  }
  const nodes = Object.values(prompts[0]);
  const inputs = nodes.filter(n => ['LoadImage', 'PrimaryInputLoadImage'].includes(n?.class_type));
  const outputs = nodes.filter(n => ['PreviewImage', 'SaveImage'].includes(n?.class_type));
  if (inputs.length !== 1 || outputs.length !== 1) throw new Error('Workflow must have one live image input and one image output');
  if (resolution?.width !== 512 || resolution?.height !== 512) throw new Error('This experimental workflow uses a 512×512 canvas');
  return { offer, prompts, resolution };
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function handleComfyRequest(req, res, config = {}) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!['/api/offer', '/api/comfy/status', '/api/workflow'].includes(pathname)) return false;
  let gpuUrl;
  try { gpuUrl = validateGpuUrl(config.gpuUrl || ''); }
  catch { reply(res, 503, { error: 'Invalid server-side ComfyStream configuration' }); return true; }
  if (req.method === 'GET' && pathname === '/api/comfy/status') {
    reply(res, 200, { configured: Boolean(gpuUrl), renderer: 'engine', inferenceVerified: false,
      message: gpuUrl ? 'ComfyStream origin configured; live GPU output remains unverified' : 'Engine ready. Configure COMFY_RACE_GPU_URL when the ComfyStream host is available.' });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/workflow') {
    try {
      const graph = JSON.parse(await fs.readFile(path.join(ROOT, 'workflows/comfy-race-sd15-depth-api.json'), 'utf8'));
      reply(res, 200, graph);
    } catch { reply(res, 503, { error: 'Bundled workflow unavailable' }); }
    return true;
  }
  if (req.method !== 'POST' || pathname !== '/api/offer') {
    reply(res, 405, { error: 'Method not allowed' });
    return true;
  }
  if (!gpuUrl) { reply(res, 503, { error: 'ComfyStream is not configured. Engine gameplay remains available.' }); return true; }
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const supplied = req.headers['x-operator-token'];
  const expected = config.operatorToken;
  const authorized = typeof supplied === 'string' && typeof expected === 'string' && expected.length > 0 &&
    Buffer.byteLength(supplied) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!local && !authorized) { reply(res, 403, { error: 'Live AI controls require the local host or its operator token.' }); return true; }
  let payload;
  try { payload = validateOffer(await readJson(req)); }
  catch (err) { reply(res, 400, { error: err.message }); return true; }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (config.token) headers.Authorization = `Bearer ${config.token}`;
    const upstream = await fetch(`${gpuUrl}/offer`, { method: 'POST', headers,
      body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000), redirect: 'error' });
    if (!upstream.ok) throw new Error('Upstream rejected signaling');
    let bytes = 0;
    const chunks = [];
    for await (const chunk of upstream.body) {
      bytes += chunk.length;
      if (bytes > MAX_BODY) throw new Error('Upstream response too large');
      chunks.push(chunk);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (result?.type !== 'answer' || typeof result.sdp !== 'string' || !result.sdp.startsWith('v=0')) throw new Error('Invalid SDP answer');
    reply(res, 200, { type: 'answer', sdp: result.sdp });
  } catch { reply(res, 502, { error: 'ComfyStream signaling failed. Check the GPU host and media connectivity.' }); }
  return true;
}
