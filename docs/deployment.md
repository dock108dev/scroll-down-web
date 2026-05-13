# Deployment

## Runtime

The app runs as a standalone Next.js server in a Docker container on a Hetzner VPS. CI ships every `main` push to dev; prod is promoted manually.

### Docker

- Base image: `node:22-alpine` (multi-stage: `deps` → `builder` → `runner`)
- Runtime: `node server.js` (Next.js standalone output — no `next` CLI)
- Port: 3001 inside the container
- User: non-root `nextjs` (uid 1001)

### docker-compose

`web/docker-compose.yml`:

```yaml
services:
  scrolldown-web:
    image: ghcr.io/dock108dev/scroll-down-web/web:latest
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:${HOST_PORT:-3001}:3001"
    env_file:
      - .env.production
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:3001"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

`HOST_PORT` is injected by the deploy job per environment so dev and prod can co-exist on the same host. There is no fixed `container_name` (different deploy paths give compose different project scopes).

### Build-time vs runtime env

`SPORTS_DATA_API_KEY` (server-only) and `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` are runtime values from the env file on the server. No `NEXT_PUBLIC_*` values are inlined into the bundle at build time today.

### Runtime env files

Created on the server and loaded via `env_file: .env.production`. Real values are never committed. Examples:

Production:

```bash
SPORTS_DATA_API_KEY=<real-api-key>
PUBLIC_BASE_URL=https://scrolldownsports.com
SITE_NOINDEX=false
# Optional: internal Docker network URL to backend
# SPORTS_API_INTERNAL_URL=http://backend:8000
```

Development:

```bash
SPORTS_DATA_API_KEY=<real-api-key>
PUBLIC_BASE_URL=https://scrolldownsports.dev
SITE_NOINDEX=true
```

### Health check

`GET /api/health`:

```json
{ "status": "ok", "timestamp": "..." }
```

Returns `503` with `{status: "degraded"}` when the upstream ping at `/api/admin/sports/games?limit=1` fails or exceeds `API.HEALTH_BACKEND_PING_TIMEOUT_MS` (15s). The result is cached for `API.HEALTH_CACHE_MS` (30s) so the `DegradedBanner` poll doesn't re-ping on every check.

Playwright's `webServer` sets `SCROLLDOWN_PLAYWRIGHT_WEB_SERVER=1`, which makes the route return `ok` immediately without pinging upstream.

### Security headers

Set in `web/next.config.ts` and applied to every response. `Cache-Control: no-store` is added to `/api/*`. Full CSP and the rest of the headers are documented in [`architecture.md`](architecture.md#security-headers).

## CI/CD

`.github/workflows/ci.yml` runs on every push and PR to `main`:

| Job | Trigger | What it does |
|-----|---------|--------------|
| `web` | always | `npm ci`, `npm audit --omit=dev --audit-level=high`, ESLint, `tsc --noEmit`, `vitest run --coverage`, `next build`. Uploads `web/coverage/` artifact. |
| `playwright-smoke` | always (skipped on fork PRs without secrets) | Builds, then runs `npx playwright test --grep "@smoke" --grep-invert "@live-upstream"`. Uploads HTML report. |
| `docker` | `main` push only, after `web` | Builds + pushes `ghcr.io/<repo>/web:latest` and `ghcr.io/<repo>/web:<sha>`. |
| `deploy-dev` | after `docker` | SSHes into Hetzner, `docker pull` + `docker compose up -d --no-deps --wait`. Uses `vars.DEPLOY_PATH` (default `/opt/scrolldown-web-dev`) and `vars.HOST_PORT` (default `3002`). |

Production promotion is manual:

- `.github/workflows/promote-prod.yml` (`workflow_dispatch`) — same SSH pattern as `deploy-dev`, but uses the `production` environment with default `DEPLOY_PATH=/opt/scrolldown-web` and `HOST_PORT=3001`.

Other workflows:

- `.github/workflows/e2e-daily.yml` — full Playwright suite on a schedule
- `.github/workflows/codeql.yml` — JavaScript/TypeScript CodeQL scan

### Required secrets (per GitHub environment)

| Secret | Purpose |
|--------|---------|
| `SPORTS_DATA_API_KEY` | Used by `playwright-smoke` for the build/run env |
| `HETZNER_HOST`, `HETZNER_USER`, `HETZNER_SSH_KEY` | SSH into the deploy host |
| `GHCR_TOKEN` | `docker login ghcr.io` on the host |

### Required variables (per GitHub environment)

| Variable | Example dev | Example prod | Purpose |
|----------|-------------|--------------|---------|
| `DEPLOY_PATH` | `/opt/scrolldown-web-dev` | `/opt/scrolldown-web` | Compose project directory |
| `HOST_PORT` | `3002` | `3001` | Host-side port binding |

### Image tags

Every `main`-branch build produces:

- `ghcr.io/<repo>/web:latest`
- `ghcr.io/<repo>/web:<commit-sha>`

## Build verification

Run before merging anything that touches the web app:

```bash
cd web
npm run lint
npx tsc --noEmit
npm run test:unit
npm run build
```

The CI `web` job runs all four (and adds `npm audit`).
