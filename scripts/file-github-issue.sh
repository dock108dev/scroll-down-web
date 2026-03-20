#!/usr/bin/env bash
set -euo pipefail

# ─── File GitHub Issue ─────────────────────────────────────
# Creates a GitHub issue for an audit finding, with deduplication.
# Usage: ./scripts/file-github-issue.sh "Title" "Description" [severity] [page] [screenshot]

TITLE="${1:?Missing title}"
DESCRIPTION="${2:?Missing description}"
SEVERITY="${3:-medium}"
PAGE="${4:-unknown}"
SCREENSHOT="${5:-}"

LABEL="ai-audit"

# Ensure label exists
gh label create "$LABEL" --description "AI agent audit finding" --color "d93f0b" 2>/dev/null || true

# Deduplication: check for existing open issue with same title
EXISTING=$(gh issue list --label "$LABEL" --state open --search "$TITLE" --json number --jq '.[0].number' 2>/dev/null || echo "")

if [ -n "$EXISTING" ] && [ "$EXISTING" != "null" ]; then
  echo "  ↳ Issue #$EXISTING already exists for: $TITLE"
  # Add a comment with the latest finding
  gh issue comment "$EXISTING" --body "$(cat <<EOF
### Re-detected on $(date +%Y-%m-%d)

**Severity:** $SEVERITY
**Page:** $PAGE

$DESCRIPTION
EOF
)"
  exit 0
fi

# Create new issue
BODY=$(cat <<EOF
## AI Audit Finding

**Date:** $(date +%Y-%m-%d)
**Severity:** $SEVERITY
**Page:** $PAGE
**Type:** Automated audit detection

## Description

$DESCRIPTION

## Reproduction Steps

1. Navigate to \`$PAGE\`
2. Observe the issue described above

## Additional Context

This issue was automatically detected by the AI agent audit system.

---
*Filed automatically by \`scripts/file-github-issue.sh\`*
EOF
)

gh issue create \
  --title "[AI Audit] $TITLE" \
  --body "$BODY" \
  --label "$LABEL"

echo "  ✓ Created issue: $TITLE"
