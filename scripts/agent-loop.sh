#!/usr/bin/env bash
set -euo pipefail

# ─── Claude Code Autonomous Audit Loop ───────────────────
# Runs Claude Code as an AI agent every 6 hours to audit the
# Scroll Down Sports web app, then review failures and attempt
# fixes autonomously.
#
# Usage:
#   tmux new -s audit
#   ./scripts/agent-loop.sh
#   # Ctrl+B, D to detach

REPO_DIR="$HOME/scroll-down-web"
WEB_DIR="$REPO_DIR/web"
LOG_DIR="/tmp/audit-agent-logs"
WAIT_SECONDS="${AUDIT_INTERVAL:-21600}"  # default 6 hours
MAX_FIX_ATTEMPTS=5
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$LOG_DIR"

# Ensure nvm/node are available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# ── Phase 1: Audit ──────────────────────────────────────
AUDIT_PROMPT='Read docs/audit-agent.md for context. You are running on the audit Mac.
The app runs as a production build (npm start). Code pull and rebuild are handled
before this phase — do NOT run git pull or npm ci yourself.

1. Verify the app is healthy: curl -s http://localhost:3001/api/health
2. Run the audit: ./scripts/agent-audit.sh --no-issues
3. Read the generated report in docs/audit-results/reports/
4. For each failure, investigate by reading the test code and any screenshots in docs/audit-results/screenshots/
5. For real bugs (not flaky tests or transient network errors), file a GitHub issue:
   ./scripts/file-github-issue.sh "title" "description" severity page
6. Summarize what you found: how many passed/failed, which failures are new, any issues filed'

# ── Phase 2: Review & Plan ──────────────────────────────
REVIEW_PROMPT='Read docs/audit-agent.md for context. You just completed an audit cycle.

1. Read the latest report in docs/audit-results/reports/ and the raw test-results.json
2. Identify all failures. For each one, read the test source code AND the app source it tests.
3. Classify each failure:
   - "test-fix": the test logic or timing needs adjustment (e.g. wrong selector, timeout too short)
   - "app-fix": the app code has a real bug you can fix
   - "upstream": the issue is in the backend data API — document in docs/upstream-api-observations.md
   - "skip": transient/env issue, not worth fixing
4. From the fixable issues, pick the top 5-10 by importance and feasibility within this session.
   Prioritize by: severity > breadth of impact > effort to fix.
5. Output a numbered plan of exactly what you will change, file by file. Be specific.
   If a fix requires updating visual regression baselines, include that step.
   If a fix requires rebuilding the app, include that step.
   If observations are upstream, append them to docs/upstream-api-observations.md.
6. Do NOT implement yet — just output the plan as a numbered list.'

# ── Phase 3: Execute Fixes ──────────────────────────────
EXECUTE_PROMPT='Read docs/audit-agent.md for context. You are executing a fix plan.
The app runs as a production build (npm start via LaunchAgent).

1. Read the latest report in docs/audit-results/reports/ and test-results.json to understand current failures.
2. Implement fixes for all failures you can address — both test issues and app bugs.
   - For test timing issues: use gotoAndWait or waitForLoadState("load") instead of networkidle
   - For data rendering waits: use explicit element waits with reasonable timeouts, skip if backend is slow
   - For visual regression: update baselines with --update-snapshots after making changes
   - For app bugs: fix the source code
   - For upstream issues: document observations in docs/upstream-api-observations.md
3. After implementing fixes, rebuild: cd web && npm run build
4. Restart the app after rebuild: launchctl kickstart -k gui/$(id -u)/com.scrolldown.web
5. Run the audit again: ./scripts/agent-audit.sh --no-issues
6. Read the new report. Output: "FAILURES_REMAINING: N" where N is the failure count.
   If N is 0, output "ALL_CLEAR" instead.'

while true; do
  TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
  LOG_FILE="$LOG_DIR/agent-$TIMESTAMP.log"

  echo "[$TIMESTAMP] ═══ Starting audit cycle ═══" | tee "$LOG_FILE"

  cd "$REPO_DIR"

  # ── Pull & rebuild (production mode, matching CI) ──
  echo "[$TIMESTAMP] Pulling latest code..." | tee -a "$LOG_FILE"
  BEFORE=$(git rev-parse HEAD)
  git pull origin main >> "$LOG_FILE" 2>&1 || true
  AFTER=$(git rev-parse HEAD)

  if [ "$BEFORE" != "$AFTER" ] || [ ! -d "$WEB_DIR/.next/standalone" ]; then
    echo "[$TIMESTAMP] Changes detected or no build — rebuilding..." | tee -a "$LOG_FILE"
    cd "$WEB_DIR" && npm ci --silent >> "$LOG_FILE" 2>&1 && npm run build >> "$LOG_FILE" 2>&1
    cd "$REPO_DIR"
    # Restart the app to pick up the new production build
    launchctl kickstart -k "gui/$(id -u)/com.scrolldown.web" >> "$LOG_FILE" 2>&1 || true
    sleep 5  # give the app a moment to start
  fi

  # ── Phase 1: Run the audit ──
  echo "[$TIMESTAMP] Phase 1: Running audit..." | tee -a "$LOG_FILE"
  claude -p "$AUDIT_PROMPT" \
    --dangerously-skip-permissions \
    --max-turns 30 \
    --output-format text \
    >> "$LOG_FILE" 2>&1 || true

  # Check if there are failures worth fixing
  FAILURES=$(jq -r '.stats.unexpected // 0' docs/audit-results/test-results.json 2>/dev/null || echo "0")

  if [ "$FAILURES" -eq 0 ]; then
    echo "[$TIMESTAMP] All tests passed — no fixes needed" | tee -a "$LOG_FILE"
  else
    echo "[$TIMESTAMP] $FAILURES failures detected — starting fix cycle" | tee -a "$LOG_FILE"

    # ── Phase 2: Review & Plan ──
    echo "[$TIMESTAMP] Phase 2: Reviewing and planning..." | tee -a "$LOG_FILE"
    claude -p "$REVIEW_PROMPT" \
      --dangerously-skip-permissions \
      --max-turns 20 \
      --output-format text \
      >> "$LOG_FILE" 2>&1 || true

    # ── Phase 3: Execute fixes (with retry loop) ──
    ATTEMPT=1
    while [ "$ATTEMPT" -le "$MAX_FIX_ATTEMPTS" ]; do
      echo "[$TIMESTAMP] Phase 3: Fix attempt $ATTEMPT/$MAX_FIX_ATTEMPTS..." | tee -a "$LOG_FILE"

      claude -p "$EXECUTE_PROMPT" \
        --dangerously-skip-permissions \
        --max-turns 40 \
        --output-format text \
        >> "$LOG_FILE" 2>&1 || true

      # Check results
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
      echo "[$TIMESTAMP] Remaining failures: $NEW_FAILURES" | tee -a "$LOG_FILE"
      # Escalate: file a GitHub issue so a human knows the agent is stuck
      if command -v gh &>/dev/null; then
        "$SCRIPT_DIR/file-github-issue.sh" \
          "Agent stuck: $NEW_FAILURES failures after $MAX_FIX_ATTEMPTS fix attempts" \
          "The autonomous audit agent was unable to resolve all test failures after $MAX_FIX_ATTEMPTS attempts on $TIMESTAMP. $NEW_FAILURES failures remain. Check logs at /tmp/audit-agent-logs/agent-$TIMESTAMP.log" \
          high \
          "agent-loop" || true
      fi
    fi
  fi

  echo "" >> "$LOG_FILE"
  echo "[$TIMESTAMP] ═══ Cycle complete ═══" | tee -a "$LOG_FILE"
  echo "[$TIMESTAMP] Next cycle in $((WAIT_SECONDS / 3600)) hours..."
  sleep "$WAIT_SECONDS"
done
