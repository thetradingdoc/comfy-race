# E06–E12: Comfy Race game UI and host operator — local-first

This is **real application code**, not a mock-up. It is runnable on any machine with Python 3.10+ and a browser. It cannot render AI frames without a running compatible GPU-hosted ComfyStream instance.

## Start locally

From the repository root:

```bash
PYTHONPATH=src python3 -m comfy_race.server --port 8090
```

Open `http://127.0.0.1:8090` for the game landing page. Select **Play Race** for preflight or **Host setup** for the operator controls. `/race` contains the live output viewport; `/race-complete` deliberately shows no invented results until native engine telemetry exists. This also serves a local diagnostics UI and explicitly reports that the GPU is not configured. No credentials or GPU needed for static UI diagnostics.

For a real GPU backend accessible from the Mac:

```bash
PYTHONPATH=src python3 -m comfy_race.server --port 8090 --gpu-url http://GPU_HOST:8889
```

Only configure an address you control. The gateway binds on loopback, validates incoming ComfyUI workflow topology and forwards exactly one SDP offer to `/offer`, using the same `{offer, prompts, resolution}` contract as the official ComfyStream UI. This is **signaling only**: video is sent peer-to-peer over WebRTC, and the GPU host still needs suitable UDP access or TURN.

## Use actual game pixels

1. Build and start the native City Racing game with `--no-hud` on Mac.
2. In OBS create **Window Capture** of the game. Start **OBS Virtual Camera**.
3. In the local browser console select the device explicitly named **OBS Virtual Camera**. A personal webcam is refused.
4. The workflow is preloaded from the bundled `workflows/comfy-race-sd15-depth-api.json`; upload another API-format workflow only when necessary.
5. In **Host setup**, click **Start live AI**. Open `/race` to view the returned video full-width. The console letterboxes the game feed into a 512×512 canvas (never stretches/crops road edges), captures at a requested 24 FPS, forwards a WebRTC offer and displays returned processed video.
6. **Only the right/primary view counts as AI output.** The source diagnostic canvas remains clearly labeled; on loss of processed frames the primary view is explicitly covered by a failure state.
7. Export diagnostic JSON for observed frame statistics. This does not equal G3 input-to-photon latency; use measurement traces in `scripts/measure_session.py`.

## What is and is not proven

The static UI, local HTTP gateway, offer validation and CPU test suite run without GPU. A real GPU host is required to prove: ComfyUI graph loads, model/engine assets exist, OpenGL game captures, outbound+return WebRTC, continuous AI output, frame coherence and the full drivable route.

**Security:** loopback-only operator server, fixed configured GPU origin, no arbitrary user-supplied upstream URL, restrictive CSP, no secrets exposed to the page. Do not publish `/api/offer` without authentication; this operator tool is for one trusted local user.
