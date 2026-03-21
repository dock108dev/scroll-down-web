# Scroll Down Sports — Audit Agent Guide

> **Audience:** AI agents (Claude Code) and human operators running on the
> headless audit Mac. This server is already fully configured — this doc
> covers how to use it, what it does, and how to keep it healthy.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Running an Audit](#2-running-an-audit)
3. [Audit Test Suite](#3-audit-test-suite)
4. [Reading Reports](#4-reading-reports)
5. [Filing GitHub Issues](#5-filing-github-issues)
6. [Agent Workflow](#6-agent-workflow)
7. [Available Commands](#7-available-commands)
8. [Background Services](#8-background-services)
9. [Monitoring & Logs](#9-monitoring--logs)
10. [Troubleshooting](#10-troubleshooting)
11. [Server Configuration Reference](#11-server-configuration-reference)

---

## 1. System Overview

This Mac runs as a headless, always-on audit server. It continuously tests the
Scroll Down Sports web app using Playwright and reports failures.

**What's running:**

| Service | How | What it does |
|---------|-----|--------------|
| Next.js app | LaunchAgent (`com.scrolldown.web`) | Serves the app at `http://localhost:3001`, auto-restarts on crash |
| Audit agent | LaunchAgent (`com.scrolldown.audit`) | Runs Claude Code as an autonomous agent every 6 hours — pulls code, audits, investigates failures, files issues |
| Sleep prevention | LaunchDaemon (`com.scrolldown.disablesleep`) | Keeps the Mac awake with lid closed |

**Key paths:**

| Path | Contents |
|------|----------|
| `/Users/dock108/scroll-down-web/` | Project root |
| `web/` | Next.js app source |
| `web/.env.local` | API keys and local config |
| `web/audit-results/` | Test output JSON files |
| `web/audit-results/reports/` | Daily markdown reports |
| `scripts/` | Audit orchestration scripts |
| `/tmp/scrolldown-web.stdout.log` | App stdout |
| `/tmp/scrolldown-web.stderr.log` | App stderr |
| `/tmp/scrolldown-audit.stdout.log` | Audit daemon stdout |
| `/tmp/audit-agent.log` | Claude Code agent output from scheduled runs |
| `/tmp/audit-agent-logs/` | Agent loop logs (tmux mode) |

**Backend:** The app proxies API calls to `https://sports-data-admin.dock108.ai`
using the key in `web/.env.local`.

---

## 2. Running an Audit

### Full audit (recommended)

```bash
cd /Users/dock108/scroll-down-web
./scripts/agent-audit.sh
```

This will:
1. Verify npm dependencies and Playwright browsers are present
2. Health-check the app at `localhost:3001`
3. Run all 7 audit test suites via Playwright
4. Generate a markdown report at `web/audit-results/reports/YYYY-MM-DD.md`
5. File GitHub issues for any failures (requires `gh auth`)

### Audit without filing issues

```bash
./scripts/agent-audit.sh --no-issues
```

### Audit skipping the health check

```bash
./scripts/agent-audit.sh --skip-health
```

### Run just the Playwright audit tests

```bash
cd /Users/dock108/scroll-down-web/web
npm run test:audit
```

### Run tests and generate a report in one step

```bash
npm run test:audit:report
```

---

## 3. Audit Test Suite

The audit project runs 7 test files covering different aspects of the app.
All tests live in `web/tests/audit/`.

| Test File | What It Checks |
|-----------|----------------|
| `crawl-all-pages.spec.ts` | Loads every discoverable page. Checks for console errors, broken images, and layout overflow. |
| `api-validation.spec.ts` | Hits every API endpoint. Validates status codes, JSON structure, and expected response shapes. |
| `data-accuracy.spec.ts` | Compares rendered data against API responses to catch display bugs or stale caches. |
| `performance-benchmarks.spec.ts` | Measures LCP, CLS, TTI, DOM content loaded, and full load time per page. |
| `accessibility.spec.ts` | Checks for a11y violations (contrast, labels, ARIA, focus management). |
| `error-scenarios.spec.ts` | Tests error handling: bad routes, invalid IDs, network failures, edge cases. |
| `visual-regression.spec.ts` | Captures screenshots for visual diff comparison against baselines. |

The audit project is configured in `web/playwright.config.ts` with:
- Always-on screenshots and video capture
- Zero retries (failures are real, not flaky)
- Desktop Chrome viewport
- Depends on the `setup` project for auth state

---

## 4. Reading Reports

Reports are saved daily at:

```
web/audit-results/reports/YYYY-MM-DD.md
```

Each report includes:

- **Page Crawl Results** — per-page load times, console errors, broken images, overflow elements
- **API Validation** — per-endpoint status, response time, JSON validity, shape validation
- **Performance Metrics** — LCP, CLS, TTI, DOM content loaded, full load per page
- **Test Suite Summary** — total/passed/failed/skipped counts

Raw JSON data is also available in `web/audit-results/`:

| File | Source |
|------|--------|
| `test-results.json` | Full Playwright JSON reporter output |
| `crawl-results.json` | Page crawl data |
| `api-validation-results.json` | API endpoint results |
| `perf-*.json` | Performance benchmark data |

### View today's report

```bash
cat web/audit-results/reports/$(date +%Y-%m-%d).md
```

### List all reports

```bash
ls web/audit-results/reports/
```

---

## 5. Filing GitHub Issues

The script `scripts/file-github-issue.sh` creates GitHub issues with
deduplication (won't create a duplicate if an open issue with the same title
exists — it adds a comment instead).

**Requires:** `gh auth login` must be completed first.

### Usage

```bash
./scripts/file-github-issue.sh "Title" "Description" [severity] [page] [screenshot]
```

- **severity:** `low`, `medium` (default), `high`, `critical`
- **page:** The page/route where the issue occurs
- Issues are labeled `ai-audit` automatically

### Examples

```bash
# API endpoint returning 500
./scripts/file-github-issue.sh \
  "GET /api/games returns 500" \
  "The games endpoint returns a 500 error with body: Internal Server Error" \
  high \
  /api/games

# Visual bug
./scripts/file-github-issue.sh \
  "Leaderboard table overflows on mobile" \
  "The golf leaderboard table has horizontal overflow at 390px viewport width" \
  medium \
  /golf/478
```

### Check auth status

```bash
gh auth status
```

---

## 6. Agent Workflow

### How it runs autonomously

The audit LaunchAgent (`com.scrolldown.audit`) fires every 6 hours and invokes:

```bash
claude -p "<audit prompt>" --dangerously-skip-permissions --max-turns 30
```

This uses your Claude Max subscription (authenticated via OAuth, credentials
stored in macOS Keychain as `Claude Code-credentials`). No API key is needed.

The `--dangerously-skip-permissions` flag lets Claude Code run shell commands,
edit files, and use all tools without interactive approval. The `--max-turns 30`
cap prevents runaway sessions.

Each cycle, the agent will:
1. `git pull origin main` and rebuild if there are changes
2. Verify the app is healthy at `localhost:3001`
3. Run `./scripts/agent-audit.sh --no-issues`
4. Read the generated report
5. Investigate each failure by reading test code and screenshots
6. File GitHub issues for real bugs via `./scripts/file-github-issue.sh`
7. Summarize findings

Output goes to `/tmp/audit-agent.log`.

### Interactive session (manual)

SSH into the Mac and start Claude Code interactively:

```bash
cd /Users/dock108/scroll-down-web
claude
```

Then give the audit prompt, or just run the audit scripts directly.

### One-off headless run

```bash
cd /Users/dock108/scroll-down-web
claude -p "Read docs/audit-agent.md. Run an audit cycle and summarize." \
  --dangerously-skip-permissions --max-turns 30
```

### Continuous loop via tmux

For more frequent cycles or custom intervals:

```bash
tmux new -s audit
/Users/dock108/scroll-down-web/scripts/agent-loop.sh
# Ctrl+B, D to detach
```

The loop script (`scripts/agent-loop.sh`) runs `claude -p` with the full audit
prompt every 6 hours (configurable via `AUDIT_INTERVAL` env var in seconds).

Reattach later: `tmux attach -t audit`

---

## 7. Available Commands

### App

```bash
npm run dev              # Start dev server (port 3001, with hot reload)
npm run build            # Production build
npm run start            # Start production server (port 3001)
npm run lint             # Run ESLint
```

### Testing

```bash
npm run test             # Run all Playwright tests
npm run test:audit       # Run audit suite only
npm run test:audit:report # Run audit + generate report
npm run test:smoke       # Smoke tests only
npm run test:ui          # Open Playwright UI
npm run test:headed      # Run tests with visible browser
```

### Audit scripts

```bash
./scripts/agent-audit.sh                # Full audit pipeline
./scripts/agent-audit.sh --no-issues    # Skip GitHub issue filing
./scripts/agent-audit.sh --skip-health  # Skip health check gate
./scripts/generate-report.sh <results-dir> <output-file>  # Generate report from JSON
./scripts/file-github-issue.sh "title" "desc" [severity] [page]  # File issue
./scripts/agent-loop.sh                 # Continuous 6-hour audit loop
```

### Health & diagnostics

```bash
curl -s http://localhost:3001/api/health | python3 -m json.tool
launchctl list | grep scrolldown
pmset -g | grep -E 'sleep|hibernate|standby|womp'
```

---

## 8. Background Services

### Web app (`com.scrolldown.web`)

- **Plist:** `~/Library/LaunchAgents/com.scrolldown.web.plist`
- **Behavior:** Starts on login, restarts on crash (`KeepAlive: true`)
- **Logs:** `/tmp/scrolldown-web.stdout.log`, `/tmp/scrolldown-web.stderr.log`

```bash
# Restart the app
launchctl kickstart -k gui/$(id -u)/com.scrolldown.web

# Stop the app
launchctl unload ~/Library/LaunchAgents/com.scrolldown.web.plist

# Start the app
launchctl load ~/Library/LaunchAgents/com.scrolldown.web.plist
```

### Audit agent (`com.scrolldown.audit`)

- **Plist:** `~/Library/LaunchAgents/com.scrolldown.audit.plist`
- **Behavior:** Runs `claude -p` every 6 hours (21600 seconds) with `--dangerously-skip-permissions`, does not run at login
- **Auth:** Uses Claude Max OAuth credentials from macOS Keychain (no API key needed)
- **Logs:** `/tmp/scrolldown-audit.stdout.log`, `/tmp/scrolldown-audit.stderr.log`, `/tmp/audit-agent.log`

```bash
# Trigger an immediate audit run
launchctl kickstart gui/$(id -u)/com.scrolldown.audit

# Stop the daemon
launchctl unload ~/Library/LaunchAgents/com.scrolldown.audit.plist

# Start the daemon
launchctl load ~/Library/LaunchAgents/com.scrolldown.audit.plist
```

### Sleep prevention (`com.scrolldown.disablesleep`)

- **Plist:** `/Library/LaunchDaemons/com.scrolldown.disablesleep.plist`
- **Behavior:** Runs `pmset -a disablesleep 1` at boot (survives reboots)

```bash
# Verify
sudo launchctl list | grep disablesleep
pmset -g | grep sleep
```

---

## 9. Monitoring & Logs

### Quick health check

```bash
curl -s http://localhost:3001/api/health | python3 -m json.tool
```

### Service status

```bash
launchctl list | grep scrolldown
# PID present = running, "-" = idle/waiting
```

### App logs

```bash
tail -f /tmp/scrolldown-web.stdout.log     # app output
tail -f /tmp/scrolldown-web.stderr.log     # app errors
```

### Audit / agent logs

```bash
tail -f /tmp/audit-agent.log               # Claude Code agent output
tail -f /tmp/scrolldown-audit.stdout.log   # daemon stdout
tail -f /tmp/scrolldown-audit.stderr.log   # daemon stderr
ls -lt /tmp/audit-agent-logs/              # tmux agent loop logs
```

### Recent reports

```bash
ls -lt web/audit-results/reports/ | head -10
```

### Disk cleanup (reports older than 30 days)

```bash
find web/audit-results -type f -mtime +30 -delete
```

---

## 10. Troubleshooting

### App not responding at localhost:3001

```bash
# Check if the process is running
launchctl list | grep scrolldown.web
lsof -i :3001

# If port is stuck, kill it and let launchd restart
kill $(lsof -t -i :3001)

# If launchd isn't restarting it, reload
launchctl unload ~/Library/LaunchAgents/com.scrolldown.web.plist
launchctl load ~/Library/LaunchAgents/com.scrolldown.web.plist

# Check app logs for errors
tail -50 /tmp/scrolldown-web.stderr.log
```

### Health returns "degraded"

The app is running but can't reach the backend at `sports-data-admin.dock108.ai`.
Check internet connectivity and backend status. Audit tests that depend on live
data will fail, but the app itself is functional.

### Playwright browser not found

```bash
npx playwright install chromium --with-deps
```

### Mac went to sleep / not reachable

```bash
# Re-apply sleep prevention
sudo pmset -a disablesleep 1 sleep 0 displaysleep 0

# Verify the LaunchDaemon is loaded
sudo launchctl list | grep disablesleep

# Fallback: run caffeinate
caffeinate -d -i -m -s &
```

### GitHub issues not filing

```bash
gh auth status
# If not authenticated:
gh auth login
```

### pmset settings reset after macOS update

macOS updates can reset power management settings. After any update:

```bash
sudo pmset -a disablesleep 1 sleep 0 displaysleep 0 disksleep 0 hibernatemode 0 standby 0
```

The `com.scrolldown.disablesleep` LaunchDaemon handles `disablesleep` on
reboot, but the other settings may need manual re-application.

### Need to rebuild after code changes

```bash
cd /Users/dock108/scroll-down-web
git pull origin main
cd web && npm ci && npm run build

# Restart the app service to pick up the new build
launchctl kickstart -k gui/$(id -u)/com.scrolldown.web
```

---

## 11. Server Configuration Reference

Current state of the audit Mac as of initial setup (2026-03-20).

| Setting | Value |
|---------|-------|
| macOS | 15.7.4 (Sequoia) |
| RAM | 8 GB |
| Node | v24.14.0 (via nvm) |
| Playwright | 1.58.2 (Chromium) |
| App port | 3001 |
| SSH | Enabled |
| FileVault | Off |
| Sleep | Disabled (all modes) |
| Wake on LAN | Enabled |
| Restart on freeze | Enabled |
| Repo path | `/Users/dock108/scroll-down-web` |
| Env file | `web/.env.local` |
| Claude Code auth | Claude Max subscription via OAuth (macOS Keychain) |
| GitHub auth | `dock108dev` via `gh` (Keychain) |
| Auto-login | Enabled |

### Installed tools

- Claude Code 2.1.81
- Homebrew 5.1.0
- Node v24.14.0 (nvm)
- Git 2.53.0
- GitHub CLI 2.88.1 (authenticated as `dock108dev`)
- Playwright 1.58.2
- tmux 3.6a

---

*This document lives at `docs/audit-agent.md` in the repo. Keep it updated
as the system evolves.*
