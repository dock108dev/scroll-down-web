#!/usr/bin/env bash
set -euo pipefail

# ─── Claude Code Autonomous Audit Loop ───────────────────
# Runs Claude Code as an AI agent every 6 hours to audit the
# Scroll Down Sports web app. Uses -p for headless mode and
# --dangerously-skip-permissions for fully autonomous operation.
#
# Usage:
#   tmux new -s audit
#   ./scripts/agent-loop.sh
#   # Ctrl+B, D to detach

REPO_DIR="$HOME/scroll-down-web"
LOG_DIR="/tmp/audit-agent-logs"
WAIT_SECONDS="${AUDIT_INTERVAL:-21600}"  # default 6 hours

mkdir -p "$LOG_DIR"

# Ensure nvm/node are available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# The prompt given to Claude Code each cycle
AGENT_PROMPT='Read docs/audit-agent.md for context. You are running on the audit Mac.

1. Pull latest code: git pull origin main
2. If there are changes, run: cd web && npm ci && npm run build
3. Verify the app is healthy: curl -s http://localhost:3001/api/health
4. Run the audit: ./scripts/agent-audit.sh --no-issues
5. Read the generated report in web/audit-results/reports/
6. For each failure, investigate by reading the test code and any screenshots in web/test-results/
7. For real bugs (not flaky tests or transient network errors), file a GitHub issue:
   ./scripts/file-github-issue.sh "title" "description" severity page
8. Summarize what you found: how many passed/failed, which failures are new, any issues filed'

while true; do
  TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
  LOG_FILE="$LOG_DIR/agent-$TIMESTAMP.log"

  echo "[$TIMESTAMP] Starting audit cycle..." | tee "$LOG_FILE"

  cd "$REPO_DIR"

  # Run Claude Code as the autonomous agent
  claude -p "$AGENT_PROMPT" \
    --dangerously-skip-permissions \
    --max-turns 30 \
    --output-format text \
    >> "$LOG_FILE" 2>&1 || true

  echo "" >> "$LOG_FILE"
  echo "[$TIMESTAMP] Audit cycle complete" | tee -a "$LOG_FILE"

  echo "[$TIMESTAMP] Next cycle in $((WAIT_SECONDS / 3600)) hours..."
  sleep "$WAIT_SECONDS"
done
