# Initial Setup — live Comfy Race

**No integrated running app exists in this repo yet.** These are upstream launch paths and required integration tests, not proof of a deployed game. Do not publish keys or licensed models.

## Mac: game and video input
1. Clone and pin [Matrix-Game](https://github.com/SkyworkAI/Matrix-Game). Obtain legitimate City Racing runtime assets.
2. Install Xcode CLT, CMake, pkg-config, SDL2, FFmpeg; follow [official racing guide](https://github.com/SkyworkAI/Matrix-Game/blob/main/Matrix-Game-4/docs/racing.md).
3. From Matrix-Game-4: `bash scripts/build_racing.sh -DRACING_ASSET_ROOT="$PWD/resources/racing"`.
4. Run `game/racing/bin/CitySampleBBoxGame --data-dir resources/racing --race --hud` and complete a course. Re-run with `--no-hud` to supply image generation with clean pixels.
5. Install OBS Studio. Window-capture the native game; start OBS Virtual Camera. Verify the selected browser source is OBS Virtual Camera, NOT the webcam.

## Configurable NVIDIA Linux host
1. Verify shell/SSH access, CUDA-compatible driver, PyTorch, TensorRT environment, GPU memory/disk, persistent processes, WebRTC media ports or TURN.
2. Install pinned [ComfyStream](https://github.com/livepeer/comfystream) + compatible ComfyUI environment and workflow nodes.
3. Test genuine live input/output through an official ComfyStream example. Then install/benchmark the [SD1.5 TensorRT/depth candidate](https://github.com/livepeer/comfystream/blob/main/workflows/comfystream/sd15-tensorrt-api.json); its JSON omits required model/engine files.
4. From Mac ComfyStream browser sender, select OBS Virtual Camera; connect to the configured GPU server. Confirm AI-generated frames return live, then drive by looking only at the AI view.
5. Record output FPS, presented FPS, action-to-photon p50/p95, stalls and course completion. Do not advertise “real-time playable” before evidence.

## Phone only after game passes
New touch controller + authenticated WebSocket gateway + native latest-input adapter in MainSDL.cpp/input abstraction. Zero throttle on disconnect and reject stale commands. This is **not supplied** by the original standalone demo.

## Hardware reality
Comfy Cloud credits may not include dedicated editable GPU VM or custom-node permission. Colab is **experimental** backup because GPU, persistent serving, WebRTC/UDP, TURN and TensorRT constraints are uncertain. A Cloudflare HTTPS tunnel does not solve WebRTC alone.

See [the full 28-task epic](BUILD_PLAN.md).
