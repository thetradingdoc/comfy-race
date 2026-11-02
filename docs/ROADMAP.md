# Comfy Race roadmap — live ComfyUI renderer

This is a proposal, not a completed application. See [BUILD_PLAN.md](BUILD_PLAN.md) for detailed acceptance criteria and system design.

1. **G0 — Native proof:** Mac build of CitySampleBBoxGame, one route driven, licensed assets and build log.
2. **G1 — Comfy proof:** Deploy configurable NVIDIA GPU; run actual ComfyStream ComfyUI workflow on live video; verify its output changes frames.
3. **G2 — Integration:** Run native game window -> OBS Virtual Camera -> ComfyStream -> ComfyUI -> WebRTC projector; no player camera.
4. **G3 — Playability or stop:** Pilot a course entirely from AI output; measure presented FPS, p95 input-to-photo latency and stalls. A failed performance gate invalidates the planned live AI game demonstration.
5. **G4 — Product quality:** One fixed visual style; playable game geometry; diagnostic reference; proper upstream attribution.
6. **G5 — Optional controls:** Phone UI, authenticated WebSocket, safe latest-input handling in `MainSDL.cpp`, reconnect; only after G3.
7. **G6 — Release:** Exact setup on one tested GPU, API-format workflow JSON, model/asset manifests, 2-minute authentic demo and submission.

**Out of scope:** multiplayer, artificial replay, accurate new city levels, freely changing prompt/world, Matrix's native 5B neural renderer, and claim that API credits equal a persistent GPU.
