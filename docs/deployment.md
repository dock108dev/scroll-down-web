# Deployment

scroll-down-web runs on a Hetzner VPS alongside sports-data-admin. Caddy handles TLS and reverse-proxying.

## Architecture

```
Internet
  │
  ├─ scrolldownsports.dev        → Caddy → 127.0.0.1:3001 (scroll-down-web)
  └─ sports-data-admin.dock108.ai → Caddy → 127.0.0.1:3000 (sports-data-admin)
```

CI pushes a Docker image to GHCR, then SSHs into the server to pull and restart the container. See [CI/CD docs](ci-cd.md) for the pipeline details.

## One-Time Server Setup

### 1. Create the project directory

```bash
sudo mkdir -p /opt/scrolldown-web
sudo chown $USER:$USER /opt/scrolldown-web
```

### 2. Create the production compose file and env

CI runs `docker compose` from `/opt/scrolldown-web`, so the compose file and env live at the repo root (not inside `web/`).

Create `/opt/scrolldown-web/docker-compose.yml`:

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

Create `/opt/scrolldown-web/.env.production`:

```
NEXT_PUBLIC_API_BASE_URL=https://sports-data-admin.dock108.ai
SPORTS_DATA_API_KEY=<your-api-key>
```

The `SPORTS_DATA_API_KEY` value matches the `API_KEY` in the sports-data-admin env.

### 3. Add a Caddy site block

Edit your Caddyfile (typically `/etc/caddy/Caddyfile`) and add:

```caddyfile
scrolldownsports.dev {
    reverse_proxy localhost:3001
}
```

Then reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy will automatically provision a TLS certificate via Let's Encrypt once DNS is pointed at the server.

### 4. Set DNS

Add an A record for `scrolldownsports.dev` pointing to your Hetzner server IP.

| Type | Name | Value |
|------|------|-------|
| A    | @    | `<server-ip>` |

If you also want `www`:

| Type  | Name | Value |
|-------|------|-------|
| CNAME | www  | `scrolldownsports.dev` |

DNS propagation typically takes a few minutes but can take up to 48 hours.

### 5. Verify GitHub Secrets

The CI workflow needs these secrets configured in the GitHub repo settings:

| Secret | Purpose |
|--------|---------|
| `HETZNER_HOST` | Server IP or hostname |
| `HETZNER_USER` | SSH username |
| `HETZNER_SSH_KEY` | SSH private key |
| `GHCR_TOKEN` | Personal access token for pulling images on the server |

`GITHUB_TOKEN` is provided automatically by GitHub Actions for pushing to GHCR.

### 6. Test the deploy

Push to `main` and let CI run, or manually pull and start:

```bash
cd /opt/scrolldown-web
docker login ghcr.io -u <github-username> -p <ghcr-token>
docker pull ghcr.io/dock108dev/scroll-down-web/web:latest
docker compose up -d --wait
```

Verify locally on the server:

```bash
curl -s http://localhost:3001 | head -20
```

Then check `https://scrolldownsports.dev` in a browser.

## Updating

Pushes to `main` trigger automatic deployment. The CI pipeline:

1. Builds and pushes a new Docker image to GHCR
2. SSHs into the server
3. Pulls the latest image
4. Restarts the container with `docker compose up -d --no-deps --wait`
5. Prunes old images

No manual intervention needed for routine updates.
