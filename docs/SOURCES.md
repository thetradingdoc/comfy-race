# Codebase Review and Evidence — Comfy Race V1

Reviewed 2 November 2026. **Source inspection is not a successful integrated deployment or a latency measurement.**

- [Matrix-Game City Racing](https://github.com/SkyworkAI/Matrix-Game/blob/main/Matrix-Game-4/docs/racing.md) — native C++ racing, SDL controls and routes.
- [SDL game engine source](https://github.com/SkyworkAI/Matrix-Game/blob/main/Matrix-Game-4/game/racing/src/MainSDL.cpp) — keyboard/gamepad, race window and `--no-hud`.
- [Matrix-Game online renderer](https://github.com/SkyworkAI/Matrix-Game/blob/main/Matrix-Game-4/docs/online.md) — existing separate causal 5B renderer; excluded from this ComfyUI live video V1.
- [ComfyStream source](https://github.com/livepeer/comfystream) — real WebRTC video processing with ComfyUI workflow nodes, single primary image input and one output.
- [SD1.5 TensorRT/depth sample API graph](https://github.com/livepeer/comfystream/blob/main/workflows/comfystream/sd15-tensorrt-api.json) — potential baseline; not a racing benchmark; requires GPU-compatible models and engines.
- [ComfyStream server implementation](https://github.com/livepeer/comfystream/blob/main/server/app.py) — Python aiortc transport and processed video output.
- [Competition](https://comfy.org/open-source-higgsfield) — actual submission requirements; verify eligibility and date.

Upstream research media is NOT a Comfy Race demo. Do not redistribute third-party models/assets without applicable rights. Original content needs a real demonstration and a reproducible setup.
