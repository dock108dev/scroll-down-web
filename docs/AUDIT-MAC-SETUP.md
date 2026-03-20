# Scroll Down Sports — Audit Mac Setup Guide

> **Purpose:** Turn an old Mac into a headless, always-on audit server that runs
> Claude Code + Playwright against the Scroll Down Sports web app continuously.
> Written so an AI agent (Claude Code) can pick this doc up on the server and
> execute every step autonomously.

---

## Table of Contents

1. [Hardware & Prerequisites](#1-hardware--prerequisites)
2. [macOS Headless Setup (Lid-Closed Mode)](#2-macos-headless-setup-lid-closed-mode)
3. [Auto-Login & Boot Resilience](#3-auto-login--boot-resilience)
4. [SSH Access](#4-ssh-access)
5. [Dev Environment](#5-dev-environment)
6. [Clone & Configure the Repo](#6-clone--configure-the-repo)
7. [Running the App](#7-running-the-app)
8. [Running the Audit Suite](#8-running-the-audit-suite)
9. [Continuous Audit Daemon](#9-continuous-audit-daemon)
10. [Claude Code Agent Loop](#10-claude-code-agent-loop)
11. [Monitoring & Maintenance](#11-monitoring--maintenance)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick Reference](#13-quick-reference)

---

## 1. Hardware & Prerequisites

**What you need:**

- The old Mac, power adapter, Ethernet cable (Wi-Fi works but wired is more reliable for 24/7)
- A temporary external keyboard + mouse/trackpad for initial setup (or another Mac to SSH from after enabling Remote Login)
- The Mac's admin username and password

**Minimum specs:**

- macOS 13 (Ventura) or later recommended
- 8 GB RAM (Playwright + Next.js + Claude Code)
- 20 GB free disk space
- Node 22, Git, Homebrew

---

## 2. macOS Headless Setup (Lid-Closed Mode)

The Mac needs to stay awake with the lid closed and no external display.

### 2a. Prevent Sleep (Terminal)

Open Terminal and run every line:

```bash
# THE critical setting — prevents sleep on lid close
sudo pmset -a disablesleep 1

# Disable all forms of sleep
sudo pmset -a sleep 0
sudo pmset -a displaysleep 0
sudo pmset -a disksleep 0
sudo pmset -a lidwake 0

# Disable hibernation and standby (laptop-specific)
sudo pmset -a hibernatemode 0
sudo pmset -a standby 0
sudo pmset -a autopoweroff 0

# Auto-restart after power failure or freeze
sudo pmset -a autorestart 1
sudo systemsetup -setrestartfreeze on
sudo systemsetup -setrestartpowerfailure on

# Wake on LAN (for remote wake)
sudo pmset -a womp 1

# Disable Power Nap (background activity noise)
sudo pmset -a powernap 0
sudo pmset -a proximitywake 0

# Keep TCP alive for SSH
sudo pmset -a tcpkeepalive 1
```

### 2b. Verify Settings

```bash
pmset -g
```

Confirm: `disablesleep 1`, `sleep 0`, `displaysleep 0`, `hibernatemode 0`.

### 2c. Survive Reboots — LaunchDaemon for disablesleep

macOS resets `disablesleep` on reboot. Create a daemon to re-apply it:

```bash
sudo tee /Library/LaunchDaemons/com.scrolldown.disablesleep.plist > /dev/null <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.scrolldown.disablesleep</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/pmset</string>
        <string>-a</string>
        <string>disablesleep</string>
        <string>1</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
XML

sudo chown root:wheel /Library/LaunchDaemons/com.scrolldown.disablesleep.plist
sudo chmod 644 /Library/LaunchDaemons/com.scrolldown.disablesleep.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.scrolldown.disablesleep.plist
```

### 2d. Disable Screen Saver

```bash
defaults -currentHost write com.apple.screensaver idleTime 0
```

### 2e. Physical Setup

1. Plug in the power adapter — **must stay plugged in 24/7**
2. Connect Ethernet if possible
3. Close the lid — the Mac should stay awake
4. Verify from another machine: `ping <mac-ip>` should respond

> **Thermal note:** With the lid closed, airflow is reduced. If the Mac runs hot,
> consider a vertical laptop stand or run it open. Thermal throttling will slow
> the audit agent down but won't cause damage.

---

## 3. Auto-Login & Boot Resilience

If the Mac reboots (power loss, update, weekly restart), it needs to log in
automatically so LaunchAgents and the app can start.

### 3a. Disable FileVault (required for auto-login)

```bash
sudo fdesetup status
# If enabled:
sudo fdesetup disable
# Requires a restart to take effect
```

### 3b. Enable Auto-Login

```bash
# Replace YOUR_USERNAME and YOUR_PASSWORD with actual values
sudo sysadminctl -autologin set -userName YOUR_USERNAME -password YOUR_PASSWORD
```

Verify: System Settings → Users & Groups → Automatic Login should show your user.

### 3c. Schedule Weekly Restart (Optional, Prevents Memory Leaks)

```bash
# Restart every Sunday at 4 AM
sudo pmset repeat restart U 04:00:00
```

Verify: `pmset -g sched`

---

## 4. SSH Access

You'll manage the audit Mac remotely. Enable SSH:

```bash
# Enable Remote Login
sudo systemsetup -setremotelogin on

# Verify
sudo systemsetup -getremotelogin

# Find the Mac's IP
ipconfig getifaddr en0    # wired
ipconfig getifaddr en1    # Wi-Fi (if no Ethernet)
```

From your other machine:

```bash
ssh YOUR_USERNAME@MAC_IP_ADDRESS
```

> **Tip:** Assign a static IP or DHCP reservation on your router so the IP
> doesn't change. Add it to your `~/.ssh/config` for convenience:
>
> ```
> Host audit-mac
>     HostName 192.168.x.x
>     User YOUR_USERNAME
> ```

---

## 5. Dev Environment

### 5a. Install Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the post-install instructions to add Homebrew to your PATH.

### 5b. Install Node 22

```bash
brew install node@22
# Or use nvm:
brew install nvm
nvm install 22
nvm use 22
nvm alias default 22
```

Verify: `node -v` → should show v22.x.x

### 5c. Install Git

```bash
brew install git
```

### 5d. Install GitHub CLI

```bash
brew install gh
gh auth login
```

This is needed for the audit scripts to file GitHub issues.

### 5e. Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Set your API key:

```bash
# Add to ~/.zshrc or ~/.bashrc
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 5f. Install Playwright Browsers

```bash
npx playwright install chromium --with-deps
```

---

## 6. Clone & Configure the Repo

### 6a. Clone

```bash
cd ~/Desktop
git clone https://github.com/YOUR_ORG/scroll-down-web.git
cd scroll-down-web/web
npm ci
```

### 6b. Environment Variables

```bash
cp .env.production.example .env.local
```

Edit `.env.local` and set:

```
SPORTS_DATA_API_KEY=your_api_key_here
```

The default backend URL is `https://sports-data-admin.dock108.ai`.
Override with `SPORTS_API_INTERNAL_URL` if you have a local backend.

---

## 7. Running the App

### 7a. Build for Production

```bash
cd ~/Desktop/scroll-down-web/web
npm run build
```

### 7b. Start the App (Foreground — for Testing)

```bash
npm run start
# App runs at http://localhost:3001
```

### 7c. Verify Health

```bash
curl -s http://localhost:3001/api/health | python3 -m json.tool
```

Expected: `{"status": "ok", "timestamp": "...", "version": "0.1.0"}`

If `"status": "degraded"`, the backend API is unreachable but the app is running.

### 7d. Run App as a Background Service

Create a LaunchAgent so the app starts automatically on login:

```bash
mkdir -p ~/Library/LaunchAgents

cat > ~/Library/LaunchAgents/com.scrolldown.web.plist <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.scrolldown.web</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd ~/Desktop/scroll-down-web/web && npm run start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/scrolldown-web.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/scrolldown-web.stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
XML

launchctl load ~/Library/LaunchAgents/com.scrolldown.web.plist
```

> **Note:** If using nvm, the `ProgramArguments` should source nvm first:
> `source ~/.nvm/nvm.sh && cd ~/Desktop/scroll-down-web/web && npm run start`

---

## 8. Running the Audit Suite

### 8a. One-Shot Audit

```bash
cd ~/Desktop/scroll-down-web

# Make sure the app is running first
curl -sf http://localhost:3001/api/health

# Run the full orchestrator
./scripts/agent-audit.sh
```

This will:
1. Check dependencies
2. Health check the app
3. Run all audit tests (crawl, API validation, data accuracy, errors, perf, a11y)
4. Generate a markdown report in `web/audit-results/reports/YYYY-MM-DD.md`
5. File GitHub issues for any failures

### 8b. Run Just the Playwright Audit Tests

```bash
cd ~/Desktop/scroll-down-web/web
npm run test:audit
```

### 8c. Run with Report Generation

```bash
cd ~/Desktop/scroll-down-web/web
npm run test:audit:report
```

### 8d. Skip Issue Filing

```bash
./scripts/agent-audit.sh --no-issues
```

---

## 9. Continuous Audit Daemon

Set up a cron job or LaunchAgent to run the audit periodically.

### Option A: Cron Job (Simple)

```bash
crontab -e
```

Add:

```
# Run audit every 6 hours
0 */6 * * * cd ~/Desktop/scroll-down-web && ./scripts/agent-audit.sh >> /tmp/audit-cron.log 2>&1
```

### Option B: LaunchAgent (Recommended)

```bash
cat > ~/Library/LaunchAgents/com.scrolldown.audit.plist <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.scrolldown.audit</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd ~/Desktop/scroll-down-web && ./scripts/agent-audit.sh --no-issues >> /tmp/audit.log 2>&1</string>
    </array>
    <key>StartInterval</key>
    <integer>21600</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/tmp/scrolldown-audit.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/scrolldown-audit.stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
XML

launchctl load ~/Library/LaunchAgents/com.scrolldown.audit.plist
```

This runs the audit every 6 hours (21600 seconds).

---

## 10. Claude Code Agent Loop

This is the main event — Claude Code acting as a user, browsing the app,
finding bugs, and filing issues.

### 10a. The Agent Workflow

The agent should:

1. Pull latest code: `git pull origin main`
2. Rebuild if needed: `npm run build`
3. Verify health: `curl http://localhost:3001/api/health`
4. Run the audit suite: `./scripts/agent-audit.sh`
5. Open the app in Playwright and explore manually (ad-hoc browsing)
6. Review audit results, investigate failures
7. File GitHub issues for real bugs
8. Generate a summary report
9. Wait, then repeat

### 10b. Starting a Claude Code Session on the Audit Mac

SSH into the Mac, then:

```bash
cd ~/Desktop/scroll-down-web
claude
```

Give Claude this prompt to start an audit cycle:

```
Read docs/AUDIT-MAC-SETUP.md for context. You are running on the audit Mac.

1. Pull latest code and rebuild if there are changes
2. Verify the app is healthy at localhost:3001
3. Run ./scripts/agent-audit.sh --no-issues
4. Read the generated report in web/audit-results/reports/
5. For each failure, investigate by reading the test code and screenshots
6. For real bugs (not flaky tests), file a GitHub issue using scripts/file-github-issue.sh
7. Summarize what you found

Available commands:
- npm run test:audit — run audit tests
- npm run test:smoke — run smoke tests
- curl localhost:3001/api/health — check app health
- ./scripts/agent-audit.sh — full audit pipeline
- ./scripts/file-github-issue.sh "title" "description" [severity] [page] — file issue
```

### 10c. Automated Agent Loop (Advanced)

For fully autonomous operation, create a loop script:

```bash
cat > ~/Desktop/scroll-down-web/scripts/agent-loop.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$HOME/Desktop/scroll-down-web"
LOG_DIR="/tmp/audit-agent-logs"
mkdir -p "$LOG_DIR"

while true; do
  TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
  LOG_FILE="$LOG_DIR/agent-$TIMESTAMP.log"

  echo "[$TIMESTAMP] Starting audit cycle..." | tee "$LOG_FILE"

  cd "$REPO_DIR"

  # Pull latest
  git pull origin main >> "$LOG_FILE" 2>&1 || true

  # Rebuild if needed
  cd web
  npm run build >> "$LOG_FILE" 2>&1 || true

  # Health check
  if ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "[$TIMESTAMP] App not healthy, skipping audit" | tee -a "$LOG_FILE"
    sleep 3600
    continue
  fi

  # Run audit
  cd "$REPO_DIR"
  ./scripts/agent-audit.sh --no-issues >> "$LOG_FILE" 2>&1 || true

  echo "[$TIMESTAMP] Audit cycle complete" | tee -a "$LOG_FILE"

  # Wait 6 hours
  sleep 21600
done
SCRIPT

chmod +x ~/Desktop/scroll-down-web/scripts/agent-loop.sh
```

Run it in a tmux/screen session:

```bash
brew install tmux
tmux new -s audit
~/Desktop/scroll-down-web/scripts/agent-loop.sh
# Ctrl+B, D to detach
# tmux attach -t audit to reattach
```

---

## 11. Monitoring & Maintenance

### Check if the App is Running

```bash
curl -s http://localhost:3001/api/health | python3 -m json.tool
```

### Check Audit Logs

```bash
# LaunchAgent logs
tail -f /tmp/scrolldown-audit.stdout.log

# Cron logs
tail -f /tmp/audit-cron.log

# Agent loop logs
ls -la /tmp/audit-agent-logs/
```

### Check LaunchAgent Status

```bash
launchctl list | grep scrolldown
```

### View Recent Reports

```bash
ls -la ~/Desktop/scroll-down-web/web/audit-results/reports/
cat ~/Desktop/scroll-down-web/web/audit-results/reports/$(date +%Y-%m-%d).md
```

### Update the Repo

```bash
cd ~/Desktop/scroll-down-web
git pull origin main
cd web && npm ci && npm run build
```

### Clean Up Old Results

```bash
# Remove reports older than 30 days
find ~/Desktop/scroll-down-web/web/audit-results -type f -mtime +30 -delete
```

### Check pmset Settings Haven't Been Reset

```bash
pmset -g | grep disablesleep
# Should show: disablesleep 1
```

---

## 12. Troubleshooting

### Mac Sleeps When Lid is Closed

```bash
# Re-apply the setting
sudo pmset -a disablesleep 1

# Verify the LaunchDaemon is loaded
sudo launchctl list | grep disablesleep

# Nuclear option: run caffeinate in background
caffeinate -d -i -m -s &
```

### App Won't Start

```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill stale process
kill $(lsof -t -i :3001)

# Restart the app
cd ~/Desktop/scroll-down-web/web && npm run start
```

### Playwright Tests Fail with "Browser Not Found"

```bash
npx playwright install chromium --with-deps
```

### SSH Connection Refused

```bash
# On the Mac (need physical access or screen sharing):
sudo systemsetup -setremotelogin on
sudo launchctl load -w /System/Library/LaunchDaemons/ssh.plist
```

### Mac Overheating in Clamshell Mode

- Use a vertical laptop stand for better airflow
- Or run with the lid open (screen will be off since displaysleep=0)
- Check temperature: `sudo powermetrics --samplers smc -i 5000 -n 1 | grep -i temp`

### GitHub Issues Not Filing

```bash
# Check gh auth
gh auth status

# Re-authenticate
gh auth login

# Test manually
gh issue list --repo YOUR_ORG/scroll-down-web
```

### `disablesleep` Reset After macOS Update

macOS updates can reset pmset settings. After any update:

```bash
sudo pmset -a disablesleep 1 sleep 0 displaysleep 0 disksleep 0
pmset -g | grep disablesleep
```

The LaunchDaemon at `/Library/LaunchDaemons/com.scrolldown.disablesleep.plist`
should handle this automatically on reboot, but verify after major OS updates.

---

## 13. Quick Reference

```bash
# ─── One-Time Setup (run these once) ─────────────────────
sudo pmset -a disablesleep 1 sleep 0 displaysleep 0 disksleep 0 lidwake 0
sudo pmset -a hibernatemode 0 standby 0 autopoweroff 0
sudo pmset -a autorestart 1 womp 1 powernap 0
sudo systemsetup -setremotelogin on
sudo systemsetup -setrestartfreeze on

# ─── Environment ─────────────────────────────────────────
brew install node@22 git gh
npm install -g @anthropic-ai/claude-code
npx playwright install chromium --with-deps

# ─── Repo Setup ──────────────────────────────────────────
cd ~/Desktop && git clone <repo-url> scroll-down-web
cd scroll-down-web/web && npm ci
cp .env.production.example .env.local  # edit with API key
npm run build

# ─── Daily Operations ────────────────────────────────────
npm run start                          # start app (foreground)
curl localhost:3001/api/health         # verify health
./scripts/agent-audit.sh              # run full audit
npm run test:audit                     # audit tests only
npm run test:smoke                     # smoke tests only

# ─── Remote Access ───────────────────────────────────────
ssh YOUR_USERNAME@MAC_IP               # connect
tmux attach -t audit                   # reattach to agent session

# ─── Monitoring ──────────────────────────────────────────
pmset -g | grep disablesleep           # verify sleep prevention
launchctl list | grep scrolldown       # check services
tail -f /tmp/scrolldown-web.stdout.log # app logs
ls web/audit-results/reports/          # audit reports
```

---

*This document lives at `docs/AUDIT-MAC-SETUP.md` in the repo. Keep it updated
as the setup evolves.*
