# CI/CD & Deployment

GitHub Actions pipeline with automated Docker builds and Hetzner deployment.

---

## Pipeline Overview

```
PR / Push to main
    │
    ├─ Web Job (ubuntu-latest, 10min timeout)
    │       ├─ npm ci
    │       ├─ ESLint (npm run lint)
    │       ├─ TypeScript check (tsc --noEmit)
    │       └─ Build (npm run build)
    │
    ├─ Docker Job (main branch pushes only, after Web Job passes)
    │       ├─ Build multi-stage image
    │       └─ Push to ghcr.io/{repo}/web:latest + :sha
    │
    └─ Deploy Job (after Docker Job, production environment)
            ├─ SSH into Hetzner
            ├─ docker pull latest image
            ├─ docker compose up -d --no-deps --wait
            └─ docker image prune
```

## Trigger Rules

| Event | Web Job | Docker + Deploy |
|---|---|---|
| PR to main | Runs | Never |
| Push to main | Runs | Runs (after Web Job passes) |
| Manual (workflow_dispatch) | Runs | Runs |

Concurrency: Runs are grouped by workflow + branch. In-progress runs are cancelled when a new push arrives.

## Web Job

Runs on `ubuntu-latest` with Node 22. Working directory: `web/`.

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run build          # NEXT_TELEMETRY_DISABLED=1
```

## Docker Build

Multi-stage Dockerfile (`web/Dockerfile`):

1. **deps** — `node:22-alpine`, `npm ci`
2. **builder** — Copy deps + source, `npm run build` (standalone output)
3. **runner** — Copy standalone output, run as non-root `nextjs` user (UID 1001), expose port 3001

Image pushed to `ghcr.io/{owner}/{repo}/web` with `latest` and commit SHA tags. Uses GitHub Actions build cache (`type=gha`).

## Deployment

### Production Architecture

```
Internet
  │
  ├─ scrolldownsports.dev        → Caddy → 127.0.0.1:3001 (scroll-down-web)
  └─ sports-data-admin.dock108.ai → Caddy → 127.0.0.1:3000 (sports-data-admin)
```

The web container binds to `127.0.0.1:3001` and is reverse-proxied by Caddy, which handles TLS via Let's Encrypt.

### Deploy Steps

After a successful Docker push, CI SSHs into the Hetzner VPS:

```bash
cd /opt/scrolldown-web
docker login ghcr.io
docker pull ghcr.io/{repo}/web:latest
docker compose up -d --no-deps --wait scrolldown-web
docker image prune -f
```

The deploy job runs in the `production` environment (may require approval depending on GitHub environment protection settings).

### One-Time Server Setup

**1. Create the project directory:**

```bash
sudo mkdir -p /opt/scrolldown-web
sudo chown $USER:$USER /opt/scrolldown-web
```

**2. Create the production compose file and env:**

`/opt/scrolldown-web/docker-compose.yml`:

```yaml
services:
  scrolldown-web:
    image: ghcr.io/dock108dev/scroll-down-web/web:latest
    container_name: scrolldown-web
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"
    env_file:
      - .env.production
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

`/opt/scrolldown-web/.env.production`:

```
NEXT_PUBLIC_API_BASE_URL=https://sports-data-admin.dock108.ai
SPORTS_DATA_API_KEY=<your-api-key>
```

**3. Add a Caddy site block** (`/etc/caddy/Caddyfile`):

```caddyfile
scrolldownsports.dev {
    reverse_proxy localhost:3001
}
```

Then `sudo systemctl reload caddy`. Caddy provisions TLS automatically once DNS is pointed.

**4. Set DNS:**

| Type | Name | Value |
|------|------|-------|
| A | @ | `<server-ip>` |
| CNAME | www | `scrolldownsports.dev` |

**5. Verify GitHub secrets** (see below).

**6. Test:** Push to `main` or manually pull and start.

## Secrets

| Secret | Used By | Purpose |
|---|---|---|
| `HETZNER_HOST` | Deploy | Server IP/hostname |
| `HETZNER_USER` | Deploy | SSH username |
| `HETZNER_SSH_KEY` | Deploy | SSH private key |
| `GHCR_TOKEN` | Deploy | Container registry auth on server |
| `GITHUB_TOKEN` | Docker | Push to GHCR (auto-provided by GitHub) |

## Environment Variables

| Variable | Required | Where | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Client + Server | Backend API base URL |
| `SPORTS_DATA_API_KEY` | Yes | Server only | Backend API authentication |

Local dev: set in `web/.env.local` (see `.env.local.example`).
Production: set in `/opt/scrolldown-web/.env.production` on the Hetzner server.

## Additional Workflows

- **CodeQL** (`codeql.yml`) — Static analysis on pushes to main and weekly (Monday 6 AM UTC). Scans JavaScript/TypeScript for security vulnerabilities.
- **Dependabot** (`dependabot.yml`) — Automated weekly dependency update PRs for `web/` npm packages (max 10 open, prefix `web:`) and GitHub Actions workflows (max 5 open, prefix `ci:`).
