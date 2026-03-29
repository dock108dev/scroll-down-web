#!/usr/bin/env bash
set -euo pipefail

# ─── Single Audit Cycle ─────────────────────────────────
# Runs one complete audit → review → fix → explore cycle using Claude Code.
# Called by the LaunchAgent every 6 hours, or manually.
#
# Usage: ./scripts/agent-cycle.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$REPO_DIR/web"
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

# ── Phase 1: Audit ──
echo "[$TIMESTAMP] Phase 1: Running audit..." | tee -a "$LOG_FILE"
claude -p 'Read docs/audit-agent.md for context. You are running on the audit Mac.
1. Verify the app is healthy: curl -s http://localhost:3001/api/health
2. Run the audit: ./scripts/agent-audit.sh --no-issues
3. Read the generated report in docs/audit-results/reports/
4. For each failure, investigate by reading the test code and screenshots
5. For real bugs, file a GitHub issue via ./scripts/file-github-issue.sh
6. Summarize: how many passed/failed, which failures are new, any issues filed' \
  --dangerously-skip-permissions \
  --max-turns 30 \
  --output-format text \
  >> "$LOG_FILE" 2>&1 || true

# Check for failures
FAILURES=$(jq -r '.stats.unexpected // 0' docs/audit-results/test-results.json 2>/dev/null || echo "0")

if [ "$FAILURES" -gt 0 ]; then
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
    # Escalate: file a GitHub issue so a human knows the agent is stuck
    if command -v gh &>/dev/null; then
      "$SCRIPT_DIR/file-github-issue.sh" \
        "Agent stuck: $NEW_FAILURES failures after $MAX_FIX_ATTEMPTS fix attempts" \
        "The autonomous audit agent was unable to resolve all test failures after $MAX_FIX_ATTEMPTS attempts on $TIMESTAMP. $NEW_FAILURES failures remain. Check logs at /tmp/audit-agent-logs/agent-$TIMESTAMP.log" \
        high \
        "agent-cycle" || true
    fi
  fi
else
  echo "[$TIMESTAMP] All tests passed — no fixes needed" | tee -a "$LOG_FILE"
fi

# ── Phase 4: Exploratory UX Review (always runs) ──
echo "[$TIMESTAMP] Phase 4: Exploratory UX review..." | tee -a "$LOG_FILE"
REVIEW_DATE=$(date +%Y-%m-%d)
claude -p "Read docs/audit-agent.md for context. You are running on the audit Mac.
The automated test suite has finished. Now you are acting as an exploratory QA
engineer and product reviewer. Your job is to browse the live app at
http://localhost:3001 like a real sports fan would and write an honest review.

Use Playwright to automate a real browser session. Write a small inline script
(npx playwright test --config=playwright.config.ts is already set up, or use the
Playwright API directly via a Node script). You MUST actually load pages, click
around, and take screenshots — do not just curl endpoints.

What to do:
1. Visit every section: home page, individual game detail pages, golf, fairbet,
   login, settings/profile. Try both desktop (1280x720) and mobile (390x844).
2. Interact like a user: expand games, reveal scores, toggle settings, navigate
   back and forth, scroll through lists.
3. Take screenshots of anything noteworthy and save them to
   docs/audit-results/screenshots/explore-*.png
4. Evaluate:
   - **Bugs**: broken layouts, dead clicks, console errors, missing data
   - **UX issues**: confusing flows, missing loading states, poor feedback
   - **Feature gaps**: what would a power sports fan expect that is missing?
   - **Data quality**: wrong scores, stale statuses, missing teams/leagues
   - **Visual/design**: dark mode issues, mobile overflow, inconsistent spacing
   - **Performance**: slow page transitions, janky animations

5. Save your full report to docs/audit-results/reports/exploratory-$REVIEW_DATE.md
   using this structure:
   # Exploratory Review — $REVIEW_DATE
   ## Bugs Found
   ## UX Issues
   ## Feature Recommendations
   ## Data Quality Observations
   ## Visual & Design Notes
   ## Screenshots

6. For any real bugs found, file a GitHub issue:
   ./scripts/file-github-issue.sh \"title\" \"description\" severity page

Be thorough and opinionated — this is the part that finds things automated tests miss." \
  --dangerously-skip-permissions \
  --max-turns 50 \
  --output-format text \
  >> "$LOG_FILE" 2>&1 || true

# ── Phase 5: Fix exploratory findings ──
echo "[$TIMESTAMP] Phase 5: Fixing exploratory findings..." | tee -a "$LOG_FILE"
claude -p "Read docs/audit-agent.md for context. You are running on the audit Mac.
The app runs as a production build (npm start via LaunchAgent).

Read the exploratory review at docs/audit-results/reports/exploratory-$REVIEW_DATE.md
and look at the screenshots in docs/audit-results/screenshots/explore-*.png.

Your job is to FIX every bug and UX issue listed in that report. Do not just plan —
actually edit the source code. For each finding:

1. Read the relevant source files to understand the current implementation.
2. Implement the fix. Be surgical — fix the issue without breaking anything else.
3. For feature recommendations that are small/medium effort, implement them too.
   Skip only large features that would take more than ~30 minutes of work.

Common fixes you should handle:
- CSS overflow issues: add overflow-hidden, fix widths, use max-w-full
- Missing pages: create simple placeholder pages (privacy, terms, etc.)
- Empty states: add helpful messaging, show next-available times
- Touch target sizes: increase to minimum 44px
- Confusing UX: add labels, redirects with messages, auto-expand defaults
- Console errors: fix broken endpoints or remove dead references

After implementing all fixes:
1. Rebuild: cd web && npm run build
2. Restart the app: launchctl kickstart -k gui/\$(id -u)/com.scrolldown.web
3. Re-run the exploratory checks — revisit the pages you fixed and take new
   screenshots to confirm the fixes (save as explore-fixed-*.png).
4. Update the exploratory report with a '## Fixes Applied' section listing
   what you changed and the before/after.
5. Run the audit suite to make sure nothing broke: ./scripts/agent-audit.sh --no-issues
6. If the audit has failures, fix those too.
7. Report what you fixed and what remains." \
  --dangerously-skip-permissions \
  --max-turns 60 \
  --output-format text \
  >> "$LOG_FILE" 2>&1 || true

echo "[$TIMESTAMP] ═══ Cycle complete ═══" | tee -a "$LOG_FILE"
