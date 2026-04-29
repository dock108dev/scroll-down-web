# Production Promotion + `.com` Setup Guide

This guide covers the full setup for:

- `scrolldownsports.com` as canonical production
- `scrolldownsports.dev` as dev-facing (noindex)
- Both running on the same server and same upstream source data
- CI auto-deploying to dev, and manual promotion deploying latest image to prod

---

## 1) Current Deployment Model (After Recent Changes)

- Main CI workflow (`.github/workflows/ci.yml`) builds/tests/pushes image and deploys to **dev**.
- Manual prod workflow (`.github/workflows/promote-prod.yml`) deploys **current `latest`** image to **prod**.
- App domain behavior is env-driven:
  - `PUBLIC_BASE_URL` controls canonical/public URLs
  - `SITE_NOINDEX=true` forces robots noindex behavior

---

## 2) What You Need To Own / Configure

## Domain + DNS (Cloudflare)

In Cloudflare DNS for `scrolldownsports.com`:

1. Add `A` record for apex:
   - Name: `@`
   - IPv4: `<your server IP>`
   - Proxy status: **Proxied** (recommended) or DNS-only if debugging
2. Add `CNAME` for `www` (optional but recommended):
   - Name: `www`
   - Target: `scrolldownsports.com`
   - Proxy status: Proxied
3. Keep existing `.dev` DNS pointed at same server for dev environment.

Notes:
- If you use IPv6 on server, also add `AAAA` records.
- Keep Cloudflare orange-cloud on unless you are diagnosing origin/cert issues.

## Cloudflare SSL/TLS

Cloudflare dashboard -> **SSL/TLS**:

- Encryption mode: **Full (strict)** (recommended)
- Always Use HTTPS: **On**
- Automatic HTTPS Rewrites: **On**
- Minimum TLS: 1.2+

Origin certificate options:
- Preferred: valid cert at origin for `.com` and `.dev` (Let's Encrypt or Cloudflare Origin Cert).
- With Full (strict), origin cert must be valid for hostname.

## Cloudflare Caching / Performance (safe defaults)

- Caching level: Standard
- Browser Cache TTL: default or 4h+
- Do not enable page rules that cache dynamic HTML for authenticated routes.
- If using WAF managed challenge, allow `/api/*` and auth/billing flows to function.

---

## 3) Server / Reverse Proxy Requirements

Both domains should route to the correct local app service on the same machine:

- `scrolldownsports.dev` -> dev container/service
- `scrolldownsports.com` (and optional `www`) -> prod container/service

Critical on a single server:

- Do **not** run both envs with the same fixed Docker `container_name`.
- Do **not** bind both envs to the same host port.
- This repo now uses `HOST_PORT` in compose (`127.0.0.1:${HOST_PORT}:3001`) and no fixed `container_name`, so you can run both at once.

Reverse proxy must forward:

- `Host`
- `X-Forwarded-For`
- `X-Forwarded-Proto`
- WebSocket upgrade headers (if applicable)

One-time SSH might be needed only to bootstrap new vhost/cert/path if not already provisioned.

---

## 4) GitHub Environments + Secrets/Vars

Create/verify GitHub Environments:

- `development`
- `production`

In each environment, set secrets:

- `HETZNER_HOST`
- `HETZNER_USER`
- `HETZNER_SSH_KEY`
- `GHCR_TOKEN`

Set environment variable:

- `DEPLOY_PATH`
  - development example: `/opt/scrolldown-web-dev`
  - production example: `/opt/scrolldown-web`
- `HOST_PORT`
  - development example: `3002`
  - production example: `3001`

If these paths differ on your server, set them to your real compose directories.

---

## 5) Runtime Environment Values (On Server)

## Dev env file (example)

```bash
SPORTS_DATA_API_KEY=<real-api-key>
PUBLIC_BASE_URL=https://scrolldownsports.dev
SITE_NOINDEX=true
# Optional:
# NEXT_PUBLIC_PLAUSIBLE_DOMAIN=scrolldownsports.dev
# MAGIC_LINK_FROM_EMAIL=noreply@mail.scrolldownsports.com
```

## Prod env file (example)

```bash
SPORTS_DATA_API_KEY=<real-api-key>
PUBLIC_BASE_URL=https://scrolldownsports.com
SITE_NOINDEX=false
# Optional:
# NEXT_PUBLIC_PLAUSIBLE_DOMAIN=scrolldownsports.com
# MAGIC_LINK_FROM_EMAIL=noreply@mail.scrolldownsports.com
```

Both envs can share same source data/backend settings.

---

## 6) AdSense + `.com` Requirements

In AdSense:

1. Add `scrolldownsports.com` in **Sites**
2. Complete site verification/review for `.com`
3. Confirm `https://scrolldownsports.com/ads.txt` is reachable and authorized

You can keep same ad slot IDs unless you intentionally split monetization by domain.

---

## 7) Promotion Flow You Run

## Normal dev deployment

- Push to `main` -> CI runs -> `deploy-dev` updates `.dev`.

## Promote dev build to prod

1. Open GitHub Actions
2. Run **Promote Prod** workflow (`promote-prod.yml`) via `workflow_dispatch`
3. Workflow pulls current `ghcr.io/<repo>/web:latest`
4. Production service restarts at production `DEPLOY_PATH`

No routine SSH needed after initial server/domain bootstrap.

---

## 8) Post-Deploy Verification Checklist

## `.com` (prod)

- `https://scrolldownsports.com` loads
- Canonical/meta URLs point to `.com`
- `https://scrolldownsports.com/sitemap.xml` returns sitemap entries
- `https://scrolldownsports.com/robots.txt` allows indexing
- Magic-link and billing return URLs resolve to `.com`
- Ads render for free users; paid/admin still suppressed

## `.dev` (dev)

- `https://scrolldownsports.dev` loads
- `robots.txt` disallows indexing (`SITE_NOINDEX=true`)
- `sitemap.xml` is empty or non-indexable behavior (expected for dev)

---

## 9) Cloudflare-Specific Pitfalls To Avoid

- **Wrong SSL mode**: avoid `Flexible`; use `Full (strict)`.
- **Over-caching HTML**: avoid rules that cache authenticated or rapidly-changing app routes.
- **Bot challenge on auth**: ensure login and callback routes are not blocked by aggressive challenge rules.
- **Missing apex record**: ensure `@` points to server, not only `www`.
- **`www` split-brain**: either redirect `www` -> apex or serve both consistently.

## 9.5) Why You Saw Overwrite/Recreate

Your log line:

- `Container scrolldown-web Recreate`

means compose targeted the same globally named container. That happens when both envs share:

- same `container_name`, and/or
- same deploy directory/compose project, and/or
- same host port

You do **not** need separate image names for dev vs prod. Same image tag can run in both environments if they are isolated by:

- different deploy paths/projects,
- different workflow-injected `HOST_PORT` values (GitHub Environment var),
- different host ports,
- and no fixed shared `container_name`.

---

## 10) Exceptions Where SSH Is Still Needed

Only for one-time/bootstrap or break-glass cases:

- Creating `/opt/scrolldown-web-dev` or `/opt/scrolldown-web` directories/compose files
- Initial reverse proxy vhost + cert installation
- Emergency recovery if GitHub Actions cannot connect or secrets are wrong

---

## Quick Copy Checklist (Your Side)

- [ ] Cloudflare DNS (`@` + optional `www`) -> same server
- [ ] Cloudflare SSL/TLS set to Full (strict)
- [ ] Origin cert valid for `.com` (+ `www` if used)
- [ ] GitHub envs created: development + production
- [ ] Deploy secrets set in both envs
- [ ] `DEPLOY_PATH` set per env
- [ ] `HOST_PORT` set per env (`3001` prod, `3002` dev suggested)
- [ ] Server env files set (`PUBLIC_BASE_URL`, `SITE_NOINDEX`)
- [ ] AdSense site added for `.com`
- [ ] Run `Promote Prod` workflow
- [ ] Verify `.com` indexable + `.dev` noindex
