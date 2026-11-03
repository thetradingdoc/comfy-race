#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${VOLTA_HOME:-$HOME/.volta}/bin:/opt/homebrew/bin:/usr/local/bin:/Library/Frameworks/Python.framework/Versions/Current/bin:$PATH"
export npm_config_cache="${npm_config_cache:-${NPM_CONFIG_CACHE:-$ROOT/.cache/npm}}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8093}"
cd "$ROOT"

command -v node >/dev/null || { echo 'Node.js 22.12 or newer is required.' >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<12)){console.error("Node.js 22.12 or newer is required.");process.exit(1)}'
command -v npm >/dev/null || { echo 'npm is required with Node.js.' >&2; exit 1; }
MATRIX_BINARY="${MATRIX_RACE_BIN:-$ROOT/resources/matrix-game/Matrix-Game-4/game/racing/bin/CitySampleRaceServer}"
MATRIX_ASSETS="${MATRIX_RACE_ASSETS:-$ROOT/resources/racing}"
if [[ ! -x "$MATRIX_BINARY" ]]; then
  if [[ -n "${MATRIX_RACE_BIN:-}" ]]; then
    printf 'Configured native binary is missing or not executable: %s\n' "$MATRIX_BINARY" >&2
    exit 1
  fi
  bash "$ROOT/scripts/setup_game.sh"
fi

MISSING_ASSETS=0
for asset in bbox-assets.bin small-city.bin race-routes.json reference-building-stripes.bin reference-junction-surfaces.bin; do
  [[ -f "$MATRIX_ASSETS/assets/$asset" ]] || MISSING_ASSETS=1
done
if [[ "$MISSING_ASSETS" == 1 ]]; then
  if [[ -n "${MATRIX_RACE_ASSETS:-}" ]]; then
    printf 'Configured racing assets are incomplete: %s\n' "$MATRIX_ASSETS" >&2
    exit 1
  fi
  python3 "$ROOT/native/bootstrap_matrix.py" --assets-only
fi
if [[ ! -d "$ROOT/game/node_modules" ]]; then
  npm --prefix "$ROOT/game" ci --include=dev
fi
npm --prefix "$ROOT/game" run build
printf '\nComfy Race: http://localhost:%s\n' "$PORT"
printf 'Engine: actual native Matrix City Racing; two human phone controllers by default.\n'
printf 'Phones: use this Mac on the same Wi-Fi; the game shows its LAN join address and QR code.\n'
printf 'Run in a normal Mac Terminal session so SDL can access the display.\n'
printf 'ComfyUI and GPU credits are optional future integrations; this launch uses native game rendering.\n\n'
exec node --env-file-if-exists="$ROOT/.env.local" "$ROOT/game/server.mjs" "$@"
