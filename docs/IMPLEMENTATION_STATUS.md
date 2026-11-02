# Comfy Race — implementation status

Last updated: 2026-11-02.

## Source-built in this repository (NOT GPU-validated)

- [x] Candidate ComfyStream-compatible SD1.5/TensorRT/Depth Anything **API graph**: `workflows/comfy-race-sd15-depth-api.json`.
- [x] Static workflow checker: `python3 scripts/check_workflow.py workflows/comfy-race-sd15-depth-api.json`.
- [x] Non-destructive Mac/GPU preflight: `python3 scripts/preflight.py --mode mac` or `--mode gpu --workspace /path/to/ComfyUI`.
- [x] Unit tests for node topology: `python3 -m unittest discover -s tests -v`.

## NOT complete; do not claim this is a playable game

- [ ] GPU host provisioned and tested with actual checkpoints and custom nodes (E02, E04, E05).
- [ ] Native C++ game built and driven on the intended Mac (E03).
- [ ] OBS game capture linked to ComfyStream browser sender (E06, E07).
- [ ] Live ComfyUI output returning from GPU to the projector (G2).
- [ ] Input-to-photon latency, frame rate, road continuity and complete AI-only race documented (G3/G4).
- [ ] Optional authenticated mobile game controller (E17-E20).

## Start with these commands

```bash
python3 -m unittest discover -s tests -v
python3 scripts/check_workflow.py workflows/comfy-race-sd15-depth-api.json
python3 scripts/preflight.py --mode mac
# On the *actual configurable GPU*:
python3 scripts/preflight.py --mode gpu --workspace /path/to/ComfyUI
```

### Important implementation constraints

The candidate graph is adapted from [Livepeer ComfyStream's public SD1.5 TensorRT graph](https://github.com/livepeer/comfystream/blob/main/workflows/comfystream/sd15-tensorrt-api.json), using the same **node classes and weights references** but a racing text prompt. The JSON is *not* a checkpoint, TensorRT engine or package installer. The 512x512 input is a potential quality/aspect-ratio problem for 16:9 game footage; fix/measure on GPU, do not assume it renders playable cars and roads.

The ComfyStream README states one primary frame-input node and one PreviewImage/SaveImage output. A static check cannot validate model availability, CUDA/TensorRT versions, stream establishment or FPS. Run the actual video test before marking G1 or G3 complete.

**Deployment:** GPU credits for queued Comfy Cloud jobs are not automatically SSH access to a persistent GPU host. Google Colab remains an experimental backup, not a confirmed media host. WebRTC may need UDP port access or TURN.

Pinned upstream source revisions used for this initial adapter:
- Matrix-Game main inspected at `51913b2bfa78a6d54de912b8348b1d318f4d36e2` (2026-10-29).
- ComfyStream main inspected at `4e9dace24b194be639db91ac983258f78eb6aafd` (2025-12-31).

These references are documentation pins; dependencies and user environments have **not** been installed.
