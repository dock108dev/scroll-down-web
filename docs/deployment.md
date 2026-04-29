# Deployment

## Environment Setup

The app runs as a standalone Next.js server in a Docker container on a Hetzner VPS.

### Docker

- **Base image**: `node:22-alpine`
- **Build**: multi-stage (deps, builder, runner) for minimal image size
- **Runtime**: `node server.js` (Next.js standalone output, no `next` CLI needed)
- **Port**: 3001 (bound to `127.0.0.1` in compose — expects a reverse proxy for public access)
- **User**: non-root `nextjs` user (UID 1001)

### docker-compose.yml

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
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:3001"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

### Runtime Environment Files

Create environment files on the server (never committed).

Production (`.com`) example:

```bash
SPORTS_DATA_API_KEY=<real-api-key>
PUBLIC_BASE_URL=https://scrolldownsports.com
SITE_NOINDEX=false
# Optional (defaults to host in PUBLIC_BASE_URL)
# NEXT_PUBLIC_PLAUSIBLE_DOMAIN=scrolldownsports.com
# Optional sender override
# MAGIC_LINK_FROM_EMAIL=noreply@mail.scrolldownsports.com
# Optional: internal Docker network URL to backend
# SPORTS_API_INTERNAL_URL=http://backend:8000
```

Development (`.dev`) example:

```bash
SPORTS_DATA_API_KEY=<real-api-key>
PUBLIC_BASE_URL=https://scrolldownsports.dev
SITE_NOINDEX=true
# Optional (defaults to host in PUBLIC_BASE_URL)
# NEXT_PUBLIC_PLAUSIBLE_DOMAIN=scrolldownsports.dev
# Optional sender override
# MAGIC_LINK_FROM_EMAIL=noreply@mail.scrolldownsports.com
# Optional: internal Docker network URL to backend
# SPORTS_API_INTERNAL_URL=http://backend:8000
```

### Health Check

The app exposes `GET /api/health` which returns:

```json
{ "status": "ok", "timestamp": "2026-03-25T12:00:00.000Z" }
```

Returns `"degraded"` with a 503 status if the backend API is unreachable. The app still serves pages in degraded mode; only API-dependent data will be missing.

### Security Headers

`next.config.ts` sets security headers on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (restricts camera/mic/geo), `Strict-Transport-Security` (HSTS, 2 years), `Content-Security-Policy` (restricts script/connect sources to self + Plausible + backend, prevents framing), `X-DNS-Prefetch-Control: off`. API routes also get `Cache-Control: no-store`.

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

### Jobs

1. **web** — lint, type check (`tsc --noEmit`), production build
2. **playwright-smoke** — runs `@smoke`-tagged Playwright tests against a dev server
3. **docker** (main branch only, after web passes) — build Docker image, push to `ghcr.io`
4. **deploy-dev** (after docker) — SSH into Hetzner, pull latest image, restart **dev** container/environment

Production promotion is intentionally separate:

- **Promote Prod** (`.github/workflows/promote-prod.yml`) — manual `workflow_dispatch` that pulls current `web:latest` and restarts the production container/environment.

### Image Tags

Every main-branch push produces two tags:
- `ghcr.io/<repo>/web:latest`
- `ghcr.io/<repo>/web:<commit-sha>`

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `HETZNER_HOST` | Server IP/hostname |
| `HETZNER_USER` | SSH username |
| `HETZNER_SSH_KEY` | SSH private key |
| `GHCR_TOKEN` | GitHub Container Registry auth token |

Set these in both GitHub Environments used by deploy jobs (`development` and `production`) unless you intentionally share one environment secret scope.

### Required Environment Variables (GitHub Environments)

| Variable | Example (dev) | Example (prod) | Purpose |
|----------|----------------|----------------|---------|
| `DEPLOY_PATH` | `/opt/scrolldown-web-dev` | `/opt/scrolldown-web` | Remote folder where `docker compose` is executed. |

### Other Workflows

- **E2E daily** (`.github/workflows/e2e-daily.yml`) — runs all Playwright tests daily at 6 AM UTC
- **CodeQL** (`.github/workflows/codeql.yml`) — weekly security scanning (JavaScript/TypeScript)
- **Dependabot** (`.github/dependabot.yml`) — weekly dependency update PRs

## Local Development

```bash
npm ci
cp .env.local.example .env.local
# Set SPORTS_DATA_API_KEY in .env.local
npm run dev
```

Dev server runs on port 3001 with webpack (hot reload). The app proxies all `/api/*` requests to the backend, so no local backend is needed — it uses the production API by default.

## Build Verification

```bash
npm run lint          # ESLint
npx tsc --noEmit      # Type check
npm run build         # Production build
```

All three must pass before merge (enforced by CI).
