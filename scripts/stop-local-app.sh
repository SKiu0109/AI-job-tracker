#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.next/local-app.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No local app PID file found."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if [[ -z "$PID" ]]; then
  rm -f "$PID_FILE"
  echo "Removed empty PID file."
  exit 0
fi

if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped local app pid $PID."
else
  echo "Local app pid $PID is not running."
fi

rm -f "$PID_FILE"
