#!/usr/bin/env bash
set -euo pipefail

# ─── Single Audit Cycle ─────────────────────────────────
# Runs one complete audit → review → fix cycle using Claude Code.
# Called by the LaunchAgent every 6 hours, or manually.
#
# Usage: ./scripts/agent-cycle.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="/tmp/audit-agent-logs"
MAX_FIX_ATTEMPTS=5
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_FILE="$LOG_DIR/agent-$TIMESTAMP.log"

mkdir -p "$LOG_DIR"

# Ensure nvm/node are available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

cd "$REPO_DIR"

echo "[$TIMESTAMP] ═══ Starting audit cycle ═══" | tee "$LOG_FILE"

# ── Phase 1: Audit ──
echo "[$TIMESTAMP] Phase 1: Running audit..." | tee -a "$LOG_FILE"
claude -p 'Read docs/audit-agent.md for context. You are running on the audit Mac.
1. Pull latest code: git pull origin main
2. If there are changes, run: cd web && npm ci && npm run build
3. Verify the app is healthy: curl -s http://localhost:3001/api/health
4. Run the audit: ./scripts/agent-audit.sh --no-issues
5. Read the generated report in docs/audit-results/reports/
6. For each failure, investigate by reading the test code and screenshots
7. For real bugs, file a GitHub issue via ./scripts/file-github-issue.sh
8. Summarize: how many passed/failed, which failures are new, any issues filed' \
  --dangerously-skip-permissions \
  --max-turns 30 \
  --output-format text \
  >> "$LOG_FILE" 2>&1 || true

# Check for failures
FAILURES=$(jq -r '.stats.unexpected // 0' docs/audit-results/test-results.json 2>/dev/null || echo "0")

if [ "$FAILURES" -eq 0 ]; then
  echo "[$TIMESTAMP] All tests passed — no fixes needed" | tee -a "$LOG_FILE"
  echo "[$TIMESTAMP] ═══ Cycle complete ═══" | tee -a "$LOG_FILE"
  exit 0
fi

echo "[$TIMESTAMP] $FAILURES failures — entering fix cycle" | tee -a "$LOG_FILE"

# ── Phase 2: Review & Plan ──
echo "[$TIMESTAMP] Phase 2: Reviewing and planning..." | tee -a "$LOG_FILE"
claude -p 'Read docs/audit-agent.md. Review the latest audit report and test-results.json.
1. Identify all failures. Read the test source AND the app source it tests.
2. Classify each: "test-fix" / "app-fix" / "upstream" / "skip"
3. Pick the top 5-10 fixable issues by importance and feasibility.
4. For upstream issues, append observations to docs/upstream-api-observations.md.
5. Output a numbered plan of exactly what you will change, file by file.' \
  --dangerously-skip-permissions \
  --max-turns 20 \
  --output-format text \
  >> "$LOG_FILE" 2>&1 || true

# ── Phase 3: Execute fixes with retry loop ──
ATTEMPT=1
while [ "$ATTEMPT" -le "$MAX_FIX_ATTEMPTS" ]; do
  echo "[$TIMESTAMP] Phase 3: Fix attempt $ATTEMPT/$MAX_FIX_ATTEMPTS..." | tee -a "$LOG_FILE"

  claude -p 'Read docs/audit-agent.md. Implement fixes for current audit failures.
1. Read the report and test-results.json.
2. Implement all fixes you can — test timing, selectors, app bugs.
3. If you changed visual tests, update baselines: npx playwright test --project=audit -g "screenshot" --update-snapshots
4. Rebuild if needed: cd web && npm run build
5. Restart app if rebuilt: launchctl kickstart -k gui/$(id -u)/com.scrolldown.web
6. Re-run audit: ./scripts/agent-audit.sh --no-issues
7. Report: "FAILURES_REMAINING: N" or "ALL_CLEAR"' \
    --dangerously-skip-permissions \
    --max-turns 40 \
    --output-format text \
    >> "$LOG_FILE" 2>&1 || true

  NEW_FAILURES=$(jq -r '.stats.unexpected // 0' docs/audit-results/test-results.json 2>/dev/null || echo "0")

  if [ "$NEW_FAILURES" -eq 0 ]; then
    echo "[$TIMESTAMP] All fixes successful on attempt $ATTEMPT" | tee -a "$LOG_FILE"
    break
  fi

  echo "[$TIMESTAMP] $NEW_FAILURES failures remain after attempt $ATTEMPT" | tee -a "$LOG_FILE"
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$ATTEMPT" -gt "$MAX_FIX_ATTEMPTS" ]; then
  echo "[$TIMESTAMP] WARNING: Unable to resolve all failures after $MAX_FIX_ATTEMPTS attempts" | tee -a "$LOG_FILE"
fi

echo "[$TIMESTAMP] ═══ Cycle complete ═══" | tee -a "$LOG_FILE"
