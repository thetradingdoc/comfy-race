// Optional real ComfyStream path. The base game never depends on this module.
const shell = document.createElement('section');
shell.id = 'comfy-panel';
shell.hidden = true;
shell.setAttribute('aria-label', 'ComfyUI renderer setup');
shell.innerHTML = `<div class="comfy-panel-head"><b>COMFY / LIVE RENDERER</b><button id="comfy-close" aria-label="Close Comfy setup">×</button></div>
<p>Engine racing works now. Connect a configured ComfyStream GPU to transform the live game canvas.</p>
<p id="comfy-status" role="status">Checking server configuration…</p>
<label>Optional API workflow JSON<input type="file" id="comfy-workflow" accept=".json,application/json"></label>
<label>Operator token <small>(only when connecting from another device)</small><input type="password" id="comfy-operator-token" autocomplete="off"></label>
<div class="comfy-actions"><button id="comfy-connect" disabled>CONNECT LIVE AI</button><button id="comfy-stop" disabled>ENGINE VIEW</button></div>
<small>Experimental: GPU output, car/road continuity, split-view quality and input latency must be tested. Credits or an API key alone do not start a streaming GPU.</small>`;
document.body.append(shell);
const launcher = document.createElement('button');
launcher.id = 'comfy-launcher';
launcher.textContent = 'COMFY AI · SETUP';
launcher.type = 'button';
launcher.title = 'Configure optional live ComfyUI rendering';
document.body.append(launcher);
const badge = document.createElement('div');
badge.id = 'render-source';
badge.setAttribute('role', 'status');
badge.textContent = 'ENGINE VIEW';
document.body.append(badge);
const output = document.createElement('video');
output.id = 'comfy-live-output';
output.autoplay = true; output.playsInline = true; output.muted = true; output.hidden = true;
document.body.append(output);
const css = document.createElement('style');
css.textContent = `#comfy-launcher{position:fixed;bottom:18px;right:24px;z-index:70;background:#111a24d9;color:#b2d5e8;border:1px solid #334758;padding:10px 14px;font:700 10px monospace;letter-spacing:1.2px;cursor:pointer;border-radius:4px}#render-source{position:fixed;bottom:23px;left:24px;z-index:70;color:#b9d4df;font:700 10px monospace;letter-spacing:1.5px;pointer-events:none}#render-source.ai{color:#a1ff9a}#comfy-panel{position:fixed;right:20px;bottom:64px;width:min(400px,calc(100vw - 40px));box-sizing:border-box;background:#101820f5;border:1px solid #345368;border-radius:10px;padding:22px;color:#e7f5ff;z-index:90;box-shadow:0 20px 80px #000a;font:13px/1.6 system-ui}#comfy-panel[hidden],#comfy-live-output[hidden]{display:none!important}.comfy-panel-head{display:flex;align-items:center;justify-content:space-between;letter-spacing:1.5px;font:700 11px monospace}.comfy-panel-head button{background:none;border:0;color:#fff;font-size:24px;cursor:pointer}#comfy-panel p{margin:13px 0;color:#bacbd7}#comfy-panel label{display:block;margin:12px 0}#comfy-panel input{display:block;margin-top:5px;width:100%;box-sizing:border-box;background:#080f16;border:1px solid #324858;color:#fff;padding:8px;border-radius:4px}#comfy-panel small{color:#98acb9;font-size:11px}.comfy-actions{display:flex;gap:8px;margin:16px 0}.comfy-actions button{padding:10px 12px;font:bold 10px monospace;background:#d6ff35;color:#0d1117;border:0;border-radius:3px;cursor:pointer}.comfy-actions button:disabled{opacity:.35;cursor:not-allowed}#comfy-live-output{position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#030609;z-index:2;pointer-events:none}@media(max-width:700px){#comfy-launcher{bottom:8px;right:8px;font-size:8px;padding:7px}#render-source{bottom:11px;left:10px;font-size:8px}}`;
document.head.append(css);
const visibilityCss = document.createElement('style');
visibilityCss.textContent = 'body.in-controller #comfy-launcher,body.in-controller #comfy-panel,body:not(.in-race) #render-source{display:none}';
document.head.append(visibilityCss);
const $ = id => document.getElementById(id);
let graph, peer, stream, capture, raf, frameToken, healthTimer, lastFrame = 0, generation = 0;
const status = text => { $('comfy-status').textContent = text; };
const engine = (message = 'ENGINE VIEW') => {
  output.hidden = true; badge.classList.remove('ai'); badge.textContent = message;
  window.dispatchEvent(new CustomEvent('race-render-source', { detail: { source: 'engine' } }));
};
function stop(message = 'Engine view active. Live AI is disconnected.') {
  generation++;
  if (raf) cancelAnimationFrame(raf);
  if (frameToken && output.cancelVideoFrameCallback) output.cancelVideoFrameCallback(frameToken);
  clearInterval(healthTimer);
  peer?.close(); stream?.getTracks().forEach(t => t.stop());
  peer = null; stream = null; output.srcObject = null;
  $('comfy-stop').disabled = true; $('comfy-connect').disabled = !$('comfy-connect').dataset.ready;
  engine(); status(message);
}
launcher.onclick = () => { shell.hidden = !shell.hidden; };
window.addEventListener('comfy-race-ai-setup', () => { shell.hidden = false; });
$('comfy-close').onclick = () => { shell.hidden = true; };
$('comfy-stop').onclick = () => stop();
$('comfy-workflow').onchange = async event => {
  try {
    const file = event.target.files[0];
    if (!file || file.size > 1_500_000) throw new Error('Choose an API-format JSON file under 1.5 MB');
    const candidate = JSON.parse(await file.text());
    if (!candidate || Array.isArray(candidate) || candidate.nodes) throw new Error('Export the API-format graph, not the editor-format graph');
    graph = candidate; status('Custom workflow loaded. Live visual quality remains unverified.');
  } catch (error) { status(error.message); }
};
function gatherIce(pc) {
  return new Promise((resolve, reject) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const timeout = setTimeout(() => { cleanup(); reject(new Error('ICE setup timed out. Check media networking/TURN.')); }, 10_000);
    function cleanup() { clearTimeout(timeout); pc.removeEventListener('icegatheringstatechange', changed); }
    function changed() { if (pc.iceGatheringState === 'complete') { cleanup(); resolve(); } }
    pc.addEventListener('icegatheringstatechange', changed);
  });
}
$('comfy-connect').onclick = async () => {
  stop('Connecting to the configured ComfyStream host…');
  $('comfy-connect').disabled = true;
  const attempt = generation;
  try {
    const source = window.comfyRaceGame?.canvas;
    if (!source || !graph) throw new Error('Game renderer or workflow is not ready');
    const health = window.comfyRaceGame.getFrameHealth?.();
    const phase = window.comfyRaceGame.getRoom?.()?.phase;
    if (!health?.ready || !['racing', 'countdown', 'paused'].includes(phase)) throw new Error('Start a native race with fresh camera frames before connecting AI.');
    capture = document.createElement('canvas'); capture.width = 512; capture.height = 512;
    const ctx = capture.getContext('2d');
    const draw = () => {
      if (generation !== attempt) return;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
      const scale = Math.min(512 / source.width, 512 / source.height);
      const w = source.width * scale, h = source.height * scale;
      ctx.drawImage(source, (512 - w) / 2, (512 - h) / 2, w, h);
      raf = requestAnimationFrame(draw);
    };
    draw(); stream = capture.captureStream(24);
    peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    const activePeer = peer;
    for (const track of stream.getTracks()) peer.addTrack(track, stream);
    peer.ontrack = event => {
      if (generation !== attempt) return;
      output.srcObject = event.streams[0] || new MediaStream([event.track]);
      output.play().catch(() => status('Click the AI setup button again to allow video playback.'));
    };
    const presented = () => {
      if (generation !== attempt) return;
      lastFrame = performance.now(); output.hidden = false;
      badge.classList.add('ai'); badge.textContent = 'COMFY STREAM · EXPERIMENTAL';
      window.dispatchEvent(new CustomEvent('race-render-source', { detail: { source: 'comfy' } }));
      frameToken = output.requestVideoFrameCallback(presented);
    };
    if (output.requestVideoFrameCallback) frameToken = output.requestVideoFrameCallback(presented);
    else output.ontimeupdate = () => { if (generation === attempt && output.currentTime > 0) { lastFrame = performance.now(); output.hidden = false; badge.textContent = 'COMFY STREAM · EXPERIMENTAL'; badge.classList.add('ai'); } };
    peer.onconnectionstatechange = () => {
      if (generation !== attempt) return;
      if (['failed', 'disconnected', 'closed'].includes(activePeer.connectionState)) {
        stop('AI connection lost. Engine view is active. Check GPU/network before reconnecting.');
      }
    };
    await peer.setLocalDescription(await peer.createOffer());
    await gatherIce(activePeer);
    if (generation !== attempt) return;
    const token = $('comfy-operator-token').value;
    const response = await fetch('/api/offer', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Operator-Token': token } : {}) },
      body: JSON.stringify({ offer: { type: 'offer', sdp: activePeer.localDescription.sdp }, prompts: [graph], resolution: { width: 512, height: 512 } }), signal: AbortSignal.timeout(25_000) });
    const answer = await response.json();
    if (!response.ok) throw new Error(answer.error || 'Comfy signaling failed');
    if (generation !== attempt) return;
    await activePeer.setRemoteDescription(answer);
    $('comfy-stop').disabled = false;
    status('Signaling connected. Waiting for returned frames; inference quality and playability are not yet verified.');
    lastFrame = performance.now();
    healthTimer = setInterval(() => {
      if (generation === attempt && performance.now() - lastFrame > 3000) {
        engine('ENGINE VIEW · AI FRAMES STALLED');
        status('AI frames stalled. Engine view is active; you can reconnect after checking the GPU.');
      }
    }, 500);
  } catch (error) { if (generation === attempt) stop(error.message); }
};
Promise.all([fetch('/api/comfy/status').then(r => r.json()), fetch('/api/workflow').then(r => r.json())]).then(([config, workflow]) => {
  graph = workflow.error ? null : workflow;
  if (config.configured && graph) { $('comfy-connect').dataset.ready = 'true'; $('comfy-connect').disabled = false; launcher.textContent = 'COMFY AI · CONNECT'; }
  status(config.message || 'Engine view is ready. ComfyStream has not been configured.');
}).catch(() => status('Engine view is ready. The optional Comfy setup endpoint is unavailable.'));
window.addEventListener('pagehide', () => stop());
