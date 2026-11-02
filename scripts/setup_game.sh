#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${VOLTA_HOME:-$HOME/.volta}/bin:/opt/homebrew/bin:/usr/local/bin:/Library/Frameworks/Python.framework/Versions/Current/bin:$PATH"
export npm_config_cache="${npm_config_cache:-${NPM_CONFIG_CACHE:-$ROOT/.cache/npm}}"
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$ROOT/.cache/pip}"
cd "$ROOT"

command -v node >/dev/null || { echo 'Node.js 22.12 or newer is required.' >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<12)){console.error("Node.js 22.12 or newer is required.");process.exit(1)}'
command -v npm >/dev/null || { echo 'npm is required with Node.js.' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3.10 or newer is required for native setup.' >&2; exit 1; }
python3 -c 'import sys; assert sys.version_info >= (3, 10), "Python 3.10 or newer is required"'

if [[ "$(uname -s)" == Darwin ]]; then
  command -v sdl2-config >/dev/null || { echo 'SDL2 development libraries are required. Install SDL2 before native setup.' >&2; exit 1; }
  command -v ffmpeg >/dev/null || { echo 'FFmpeg development libraries are required. Install FFmpeg before native setup.' >&2; exit 1; }
fi

if [[ ! -x "$ROOT/.venv-native/bin/python" ]]; then
  python3 -m venv "$ROOT/.venv-native"
fi
"$ROOT/.venv-native/bin/python" -m pip install --disable-pip-version-check -r "$ROOT/native/requirements-tools.txt"
"$ROOT/.venv-native/bin/python" "$ROOT/native/bootstrap_matrix.py" --jobs "${BUILD_JOBS:-4}"
npm --prefix "$ROOT/game" ci --include=dev
npm --prefix "$ROOT/game" run build
printf '\nSetup complete: actual Matrix City Racing engine and two-player native rules test.\n'
printf 'Run ./scripts/run_game.sh from a normal Mac Terminal session.\n'
