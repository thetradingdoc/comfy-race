#!/usr/bin/env bash
# E01/E03: repeatable source checkout; optional native build; never downloads models or runs neural inference.
set -euo pipefail
PIN="51913b2bfa78a6d54de912b8348b1d318f4d36e2"
ROOT="${1:-$HOME/comfy-race-upstream}"
case "${2:-checkout}" in checkout|build) ;; *) echo "Usage: $0 [destination] [checkout|build]" >&2; exit 64;; esac
if [[ ! -d "$ROOT/.git" ]]; then
  if [[ -e "$ROOT" ]]; then echo "Refusing to overwrite existing non-git path: $ROOT" >&2; exit 2; fi
  git clone https://github.com/SkyworkAI/Matrix-Game.git "$ROOT"
fi
git -C "$ROOT" fetch origin "$PIN"
git -C "$ROOT" checkout --detach "$PIN"
CURRENT="$(git -C "$ROOT" rev-parse HEAD)"
[[ "$CURRENT" == "$PIN" ]] || { echo "Wrong upstream commit" >&2; exit 2; }
echo "Pinned Matrix-Game at $CURRENT"
if [[ "${2:-checkout}" == build ]]; then
  cd "$ROOT/Matrix-Game-4"
  echo "Building native racer. Racing assets must be obtained separately per official manifest."
  bash scripts/build_racing.sh -DRACING_ASSET_ROOT="$PWD/resources/racing"
  echo "Build finished; verify actual gameplay on this Mac (E03 not automatic)."
fi
cat <<'EOF'
Required next steps:
1. Obtain City Racing game assets from the official pinned v4 manifests; licenses and attribution apply.
2. In Matrix-Game-4/, run:
   game/racing/bin/CitySampleBBoxGame --data-dir resources/racing --race --hud
3. Finish the native route using W/A/S/D. Only then record G0 success.
4. For model conditioning, re-run the game with --no-hud.
EOF
