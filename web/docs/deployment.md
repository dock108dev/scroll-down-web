# Deployment

## Production Setup

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

### Production Environment

Create `.env.production` on the server (never committed):

```bash
SPORTS_DATA_API_KEY=<real-api-key>
# Optional: internal Docker network URL to backend
# SPORTS_API_INTERNAL_URL=http://backend:8000
```

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

### Jobs

1. **web** — lint, type check (`tsc --noEmit`), production build
2. **docker** (main branch only, after web passes) — build Docker image, push to `ghcr.io`
3. **deploy** (after docker) — SSH into Hetzner, pull latest image, restart container

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

### Other CI

- **CodeQL** (`.github/workflows/codeql.yml`) — automated security scanning
- **Dependabot** (`.github/dependabot.yml`) — dependency update PRs

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
