#!/usr/bin/env bash
# E01/E04: pinned source checkout only. GPU install and live inference must be run on the provisioned host.
set -euo pipefail
PIN="4e9dace24b194be639db91ac983258f78eb6aafd"
ROOT="${1:-$HOME/comfy-race-comfystream}"
if [[ ! -d "$ROOT/.git" ]]; then
  if [[ -e "$ROOT" ]]; then echo "Refusing to overwrite existing non-git path: $ROOT" >&2; exit 2; fi
  git clone https://github.com/livepeer/comfystream.git "$ROOT"
fi
git -C "$ROOT" fetch origin "$PIN"
git -C "$ROOT" checkout --detach "$PIN"
CURRENT="$(git -C "$ROOT" rev-parse HEAD)"
[[ "$CURRENT" == "$PIN" ]] || { echo "Wrong upstream commit" >&2; exit 2; }
echo "Pinned ComfyStream at $CURRENT"
cat <<'EOF'
This script does NOT install GPU, ComfyUI, TensorRT or workflow checkpoints.
On the actual configurable NVIDIA GPU, follow pinned ComfyStream README
for the environment, model assets, custom nodes, server and UI.
Do not mark E04 complete until a real ComfyUI output video stream is demonstrated.
EOF
