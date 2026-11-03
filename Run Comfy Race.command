#!/usr/bin/env bash
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$ROOT/scripts/run_game.sh" "$@"
RESULT=$?
if [[ "$RESULT" != 0 ]]; then
  printf '\nComfy Race stopped with an error (%s). See the message above.\n' "$RESULT"
  if [[ -t 0 ]]; then read -r -p 'Press Enter to close this window.'; fi
fi
exit "$RESULT"
