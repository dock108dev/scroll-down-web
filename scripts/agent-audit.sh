#!/usr/bin/env bash
set -euo pipefail

# ─── Agent Audit Orchestrator ──────────────────────────────
# Main script for running the AI audit suite.
# Usage: ./scripts/agent-audit.sh [--skip-health] [--no-issues]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$PROJECT_DIR/web"
RESULTS_DIR="$WEB_DIR/audit-results"
REPORTS_DIR="$RESULTS_DIR/reports"
DATE=$(date +%Y-%m-%d)

SKIP_HEALTH=false
NO_ISSUES=false

for arg in "$@"; do
  case $arg in
    --skip-health) SKIP_HEALTH=true ;;
    --no-issues) NO_ISSUES=true ;;
  esac
done

echo "═══════════════════════════════════════════════"
echo "  Scroll Down Sports — AI Agent Audit"
echo "  Date: $DATE"
echo "═══════════════════════════════════════════════"
echo ""

# ─── 1. Ensure dependencies ───────────────────────────────
echo "→ Checking dependencies..."
cd "$WEB_DIR"

if [ ! -d "node_modules" ]; then
  echo "  Installing npm dependencies..."
  npm ci --silent
fi

# Ensure Playwright browsers
npx playwright install chromium --with-deps 2>/dev/null || true

# ─── 2. Health check gate ─────────────────────────────────
if [ "$SKIP_HEALTH" = false ]; then
  echo "→ Running health check..."
  HEALTH_URL="http://localhost:3001/api/health"
  HEALTH_RESPONSE=$(curl -sf "$HEALTH_URL" 2>/dev/null || echo '{"status":"unreachable"}')
  HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ "$HEALTH_STATUS" = "unreachable" ]; then
    echo "  ✗ App is not running at localhost:3001"
    echo "  Start the app first: cd web && npm run dev"
    exit 1
  elif [ "$HEALTH_STATUS" = "degraded" ]; then
    echo "  ⚠ App is running but backend is degraded"
    echo "  Continuing with audit (some tests may fail)..."
  else
    echo "  ✓ App is healthy"
  fi
fi

# ─── 3. Run audit suite ──────────────────────────────────
echo ""
echo "→ Running audit test suite..."
mkdir -p "$RESULTS_DIR" "$REPORTS_DIR"

npx playwright test --project=audit --reporter=json 2>/dev/null \
  > "$RESULTS_DIR/test-results.json" || true

echo "  ✓ Audit tests complete"

# ─── 4. Generate report ──────────────────────────────────
echo ""
echo "→ Generating report..."
"$SCRIPT_DIR/generate-report.sh" "$RESULTS_DIR" "$REPORTS_DIR/$DATE.md"
echo "  ✓ Report saved to audit-results/reports/$DATE.md"

# ─── 5. File GitHub issues ───────────────────────────────
if [ "$NO_ISSUES" = false ] && command -v gh &>/dev/null; then
  echo ""
  echo "→ Filing GitHub issues for failures..."
  FAILURES=$(jq -r '.suites[]?.specs[]? | select(.ok == false) | .title' \
    "$RESULTS_DIR/test-results.json" 2>/dev/null || echo "")

  if [ -n "$FAILURES" ]; then
    while IFS= read -r title; do
      [ -z "$title" ] && continue
      "$SCRIPT_DIR/file-github-issue.sh" "$title" "Audit failure detected" || true
    done <<< "$FAILURES"
    echo "  ✓ Issues filed"
  else
    echo "  ✓ No failures to report"
  fi
else
  echo ""
  echo "→ Skipping GitHub issue filing (--no-issues or gh not installed)"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  Audit complete! Results in: audit-results/"
echo "═══════════════════════════════════════════════"
