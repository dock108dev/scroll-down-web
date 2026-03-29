#!/usr/bin/env bash
set -euo pipefail

# ─── Claude Code Autonomous Audit Loop ───────────────────
# Runs agent-cycle.sh on a repeating interval. Each cycle handles
# the full pipeline: triage → audit → fix → explore → fix → PR.
#
# Usage:
#   tmux new -s audit
#   ./scripts/agent-loop.sh
#   # Ctrl+B, D to detach
#
# Override interval: AUDIT_INTERVAL=3600 ./scripts/agent-loop.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WAIT_SECONDS="${AUDIT_INTERVAL:-21600}"  # default 6 hours

while true; do
  TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
  echo "[$TIMESTAMP] ═══ Starting audit cycle ═══"

  "$SCRIPT_DIR/agent-cycle.sh" || echo "[$TIMESTAMP] Cycle exited with error (continuing)"

  TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
  echo "[$TIMESTAMP] Next cycle in $((WAIT_SECONDS / 3600)) hours..."
  sleep "$WAIT_SECONDS"
done
