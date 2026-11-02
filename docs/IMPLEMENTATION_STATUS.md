# Comfy Race — P0 implementation status (E01–E16)

Updated 2026-11-02. **No E01–E16 acceptance gate is fully verified.** Committed code ≠ running game.

| Epic | Acceptance requirement | Implemented without GPU | Verified status |
|---|---|---|---|
| E01 | Pin source, dependencies, rights | `config/upstreams.lock.json`, pinned checkout scripts and upstream code-license inventory | **Partial:** model/asset rights still unresolved |
| E02 | Configurable NVIDIA machine, SSH/network/GPU proof | `scripts/preflight.py --mode gpu` | **Blocked:** actual GPU access required |
| E03 | Mac game build, complete route | `scripts/bootstrap_racer.sh` | **Blocked:** actual Mac, game assets, compilation and driving |
| E04 | Live ComfyStream + ComfyUI video output | Pinned ComfyStream checkout script | **Blocked:** actual GPU/media test |
| E05 | SD1.5/TensorRT/depth compatible model stack | `workflows/comfy-race-sd15-depth-api.json`; `scripts/workflow_asset_report.py` | **Partial:** no installed engines/checkpoints |
| E06 | OBS captures clean game window | Steps in `docs/GETTING_STARTED.md` | **Blocked:** Mac + OBS |
| E07 | ComfyStream returns stylized moving race frames | Candidate API graph and steps | **Blocked:** full live integration |
| E08 | 16:9 game view → 512-square workflow without unacceptable loss | `scripts/frame_geometry.py` plus **real browser canvas letterboxing** in `src/comfy_race/static/app.js` | **Software done; acceptance blocked:** evaluate actual roads/car on live AI feed |
| E09 | One visually coherent tested style | Fixed text prompt in candidate workflow | **Partial:** no image/video quality proof |
| E10 | Measured presented FPS, p50/p95 input-to-photon, stalls | **Implemented** browser presented-frame health sampling + export; `scripts/measure_session.py` computes percentiles from real timing CSV | **Partial:** real correlated input/output events and GPU timings absent |
| E11 | Finish full course watching only AI imagery | — | **Blocked:** E02–E10 |
| E12 | Diagnostic source/AI views and loss-of-AI state | **Implemented** browser source diagnostic pane, separate AI-only primary stage, connection/freeze/error states and exportable client stats; HTTP signaling proxy | **Code delivered; real stream failure behavior not hardware-verified** |
| E13 | Venue screen/audio/network rehearsal | — | **Blocked:** venue and running app |
| E14 | Actual reproducible source/model/workflow/license setup | Repo, workflow, static tests and docs | **Partial:** no reproducible GPU install |
| E15 | Authentic under-two-minute gameplay video | — | **Blocked:** working demo |
| E16 | Verify rules + submit | Published public repository only | **Blocked:** eligible tested entry and submission |

## Operator application committed

```bash
python3 -m pip install -e .
comfy-race-operator --port 8090
# Configure a controlled GPU server once E02 passes:
comfy-race-operator --port 8090 --gpu-url http://GPU_HOST:8889
```

Open http://127.0.0.1:8090 and follow [operator documentation](OPERATOR_CONSOLE.md). The app is a local operator console, NOT an AI renderer by itself. OBS capture and live GPU AI remain essential.

**CI warning:** GitHub Actions workflow runs were reported as failures while building. No green CI status was verified. Tests are written and committed; actual successful execution of the current repository suite remains to be confirmed.

## Commands that can be run now

```bash
python3 -m unittest discover -s tests -v
python3 scripts/check_workflow.py workflows/comfy-race-sd15-depth-api.json
python3 scripts/workflow_asset_report.py workflows/comfy-race-sd15-depth-api.json
python3 scripts/frame_geometry.py --width 1280 --height 720 --mode contain
python3 scripts/preflight.py --mode mac
bash scripts/bootstrap_racer.sh "$HOME/comfy-race-matrix" checkout
# To attempt native game compilation on a prepared Mac:
bash scripts/bootstrap_racer.sh "$HOME/comfy-race-matrix" build
```

On a configurable NVIDIA host:
```bash
python3 scripts/preflight.py --mode gpu --workspace /path/to/ComfyUI
bash scripts/bootstrap_comfystream.sh "$HOME/comfy-race-comfystream"
python3 scripts/workflow_asset_report.py workflows/comfy-race-sd15-depth-api.json --workspace /path/to/ComfyUI
```

## Source pins and rights

- Matrix-Game `51913b2bfa78a6d54de912b8348b1d318f4d36e2` (v4 code Apache-2.0, separate game assets; certain racing audio CC0/CC BY 3.0).
- ComfyStream `4e9dace24b194be639db91ac983258f78eb6aafd` (MIT).
- Candidate GPU graph based on upstream SD1.5/TensorRT/depth example blob `9c338aa88f6430c8b6bfe2b8d035cb5ca347e464`.
- Unverified model licenses and CUDA/TensorRT compatibility documented in `config/upstreams.lock.json`.
- No included checkpoints or redistributed racing asset bundle.

**Hard stop:** Do not claim a playable ComfyUI-rendered race until G3 has measured evidence from the real input → game → ComfyUI → output screen path. The offline metrics tool cannot create such evidence by itself.
