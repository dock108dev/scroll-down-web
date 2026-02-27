# CI/CD

GitHub Actions pipeline with path-based filtering, automated Docker builds, and Hetzner deployment.

## Pipeline Overview

```
PR / Push to main
    │
    ├─ Changes Detection (paths-filter)
    │       ├─ ScrollDown/** → iOS job
    │       └─ web/** → Web job
    │
    ├─ iOS Job (macos-15, 30min timeout)
    │       ├─ Select Xcode 16+
    │       ├─ Ensure iOS Simulator runtime
    │       ├─ Build (xcodebuild build-for-testing)
    │       ├─ Test (xcodebuild test-without-building)
    │       └─ Coverage summary (xcrun xccov)
    │
    ├─ Web Job (ubuntu-latest, 10min timeout)
    │       ├─ npm ci
    │       ├─ ESLint (npm run lint)
    │       ├─ TypeScript check (tsc --noEmit)
    │       └─ Build (npm run build)
    │
    ├─ Docker Job (main branch + web changes only)
    │       ├─ Build multi-stage image
    │       └─ Push to ghcr.io/{repo}/web:latest + :sha
    │
    └─ Deploy Job (after Docker, main branch only)
            ├─ SSH into Hetzner
            ├─ docker pull latest image
            ├─ docker compose up -d --no-deps --wait
            └─ docker image prune
```

## Trigger Rules

| Event | iOS Job | Web Job | Docker + Deploy |
|-------|---------|---------|-----------------|
| PR to main | Runs if `ScrollDown/**` changed | Runs if `web/**` changed | Never |
| Push to main | Always runs | Always runs | Only if `web/**` changed |

Concurrency: Runs are grouped by workflow + branch. In-progress runs are cancelled when a new push arrives.

## iOS Job

Runs on `macos-15`. Selects the latest Xcode 16.x available on the runner. Dynamically picks an available iPhone simulator.

Generates a placeholder `Info.plist` for CI (API key set to `CI_PLACEHOLDER`, local networking allowed).

```bash
xcodebuild build-for-testing -scheme ScrollDown -destination '...'
xcodebuild test-without-building -scheme ScrollDown -destination '...' -enableCodeCoverage YES
```

## Web Job

Runs on `ubuntu-latest` with Node 22. Working directory: `web/`.

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

## Docker Build

Multi-stage Dockerfile (`web/Dockerfile`):

1. **deps** — `node:22-alpine`, `npm ci`
2. **builder** — Copy deps + source, `npm run build` (standalone output)
3. **runner** — Copy standalone output, run as non-root `nextjs` user, expose port 3000

Image pushed to `ghcr.io/{owner}/{repo}/web` with `latest` and commit SHA tags.

## Hetzner Deployment

Deployment runs after a successful Docker push. Uses SSH (`appleboy/ssh-action`) to connect to the Hetzner VPS.

```bash
cd /opt/scrolldown-web
docker login ghcr.io
docker pull ghcr.io/{repo}/web:latest
docker compose up -d --no-deps --wait scrolldown-web
docker image prune -f
```

The web container binds to `127.0.0.1:3000` (reverse-proxied to the public domain).

## Secrets

| Secret | Used By | Purpose |
|--------|---------|---------|
| `HETZNER_HOST` | Deploy | Server IP/hostname |
| `HETZNER_USER` | Deploy | SSH username |
| `HETZNER_SSH_KEY` | Deploy | SSH private key |
| `GHCR_TOKEN` | Deploy | Container registry auth on server |
| `GITHUB_TOKEN` | Docker | Push to GHCR (auto-provided) |

## Additional Workflows

- **CodeQL** (`codeql.yml`) — Static analysis on pull requests. Scans for vulnerabilities.

## Environment Variables

### iOS

Set via Xcode environment or `Info.plist`:

| Variable | Purpose |
|----------|---------|
| `SPORTS_DATA_API_KEY` | Backend API authentication |
| `IOS_BETA_ASSUME_NOW` | Snapshot mode time override (debug only) |

### Web

| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | `https://sports-data-admin.dock108.ai` |
| `SPORTS_DATA_API_KEY` | Backend API authentication (server-side only) | — |
| `NEXTAUTH_URL` | App domain (production) | `https://scrolldownsports.dock108.dev` |
| `NEXTAUTH_SECRET` | Auth secret (production) | — |

See `web/.env.local.example` and `web/.env.production.example` for templates.
