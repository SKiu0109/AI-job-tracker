#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.next/local-app.pid"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"

cd "$ROOT_DIR"
mkdir -p "$(dirname "$PID_FILE")"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE")"
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "Local app is already running at http://$HOST:$PORT (pid $EXISTING_PID)."
    exit 0
  fi
fi

echo "Starting local app at http://$HOST:$PORT ..."
HOST="$HOST" PORT="$PORT" pnpm exec next dev --hostname "$HOST" --port "$PORT" > "$ROOT_DIR/.next/local-app.log" 2>&1 &
echo "$!" > "$PID_FILE"
echo "Started pid $(cat "$PID_FILE"). Logs: $ROOT_DIR/.next/local-app.log"
