# CI/CD

GitHub Actions pipeline with automated Docker builds and Hetzner deployment.

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
    └─ Deploy Job (after Docker Job)
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

Concurrency: Runs are grouped by workflow + branch. In-progress runs are cancelled when a new push arrives.

## Web Job

Runs on `ubuntu-latest` with Node 22. Working directory: `web/`.

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

Build uses `NEXT_TELEMETRY_DISABLED=1`.

## Docker Build

Multi-stage Dockerfile (`web/Dockerfile`):

1. **deps** — `node:22-alpine`, `npm ci`
2. **builder** — Copy deps + source, `npm run build` (standalone output)
3. **runner** — Copy standalone output, run as non-root `nextjs` user, expose port 3000

Image pushed to `ghcr.io/{owner}/{repo}/web` with `latest` and commit SHA tags.

Uses GitHub Actions build cache (`type=gha`) for faster builds.

## Hetzner Deployment

Deployment runs after a successful Docker push. Uses SSH (`appleboy/ssh-action@v1`) to connect to the Hetzner VPS.

```bash
cd /opt/scrolldown-web
docker login ghcr.io
docker pull ghcr.io/{repo}/web:latest
docker compose up -d --no-deps --wait scrolldown-web
docker image prune -f
```

The web container binds to `127.0.0.1:3000` and is reverse-proxied to `scrolldownsports.dock108.dev`.

## Secrets

| Secret | Used By | Purpose |
|---|---|---|
| `HETZNER_HOST` | Deploy | Server IP/hostname |
| `HETZNER_USER` | Deploy | SSH username |
| `HETZNER_SSH_KEY` | Deploy | SSH private key |
| `GHCR_TOKEN` | Deploy | Container registry auth on server |
| `GITHUB_TOKEN` | Docker | Push to GHCR (auto-provided by GitHub) |

## Additional Workflows

- **CodeQL** (`codeql.yml`) — Static analysis on pull requests. Scans for security vulnerabilities.
- **Dependabot** (`dependabot.yml`) — Automated dependency update PRs for `web/` npm packages.

## Environment Variables (Production)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL (`https://sports-data-admin.dock108.ai`) |
| `SPORTS_DATA_API_KEY` | Backend API authentication (server-side only) |

These are set on the Hetzner server via docker-compose environment or `.env` file. See `web/.env.production.example` for the template.
