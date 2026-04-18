# Docs Consolidation Audit

**Date**: 2026-04-18

## What Changed

### ARCHITECTURE.md (root) — Merged and Expanded

The root `ARCHITECTURE.md` was missing substantial content that existed only in `docs/architecture.md`:

- Analytics API routes (16 routes for ML simulator, models, batch sims, outcomes)
- Simulator API routes (multi-sport Monte Carlo)
- Tracking and Health routes
- Detailed auth proxy security section (path whitelist table, rate limit tiers)
- Analytics feature section (tab navigation, MLB pages, multi-sport simulators, service layer)
- SEO & Discoverability section (robots.ts, sitemap.ts, manifest.ts, OG images)
- Detailed analytics event tracking list
- Degraded-state handling with localStorage cache key names and implementation pointers
- `game-core` store (missing from Zustand table)
- Three missing hooks: `useFollowingLive`, `useFreshnessLabel`, `useHistoricalGames`
- Hook count corrected: was "13 hooks", actually 14

All content from both files was merged into the root `ARCHITECTURE.md`. Duplicate sections were deduplicated, keeping the cleaner version.

### docs/architecture.md — Deleted

Superseded by the merged root `ARCHITECTURE.md`. All unique content was incorporated before deletion.

### BRAINDUMP.md — Archived

Moved to `docs/archived/braindump.md`. It is an external product/UX critique and audit, not a technical reference. Valuable as historical context but not useful as developer documentation.

### docs/research/ — Archived

All 13 research documents moved to `docs/archived/research/`. These are one-time evaluations that informed roadmap decisions but are not maintained current references:

- ai-sports-summary-quality.md
- betting-odds-api.md
- betting-odds-apis.md
- competitor-ux-audit.md
- fair-value-ev-calculation.md
- freemium-sports-app-monetization.md
- golf-data-apis.md
- live-scores-api.md
- non-intrusive-ad-formats.md
- pwa-offline-score-caching.md
- realtime-websocket-patterns.md
- score-reveal-ux-patterns.md
- sports-app-trust-signals.md
- sports-data-apis.md

The `docs/research/` directory was removed. `docs/archived/research/` is not linked from primary navigation.

### docs/README.md — Created

New navigation index for all docs. Lists root docs, technical reference, development docs, audit docs, and archived material with one-line descriptions.

### README.md (root) — Updated

The "More Documentation" section now explicitly links to `ARCHITECTURE.md`, `DESIGN.md`, `ROADMAP.md`, and `docs/README.md` instead of pointing vaguely at `docs/`.

## What Was Not Changed

These files were verified accurate against the codebase and left untouched:

- `DESIGN.md` — Design principles and patterns. Accurate.
- `ROADMAP.md` — Product roadmap. Accurate.
- `CLAUDE.md` — Developer onboarding rules. Accurate.
- `docs/client-logic.md` — 37 client-side patterns. Accurate.
- `docs/development.md` — Local setup and QA checklist. Accurate.
- `docs/deployment.md` — Docker, CI/CD, Hetzner deploy. Accurate.
- `docs/env-and-config.md` — Environment variables and config.ts constants. Accurate.
- `docs/realtime.md` — Realtime transport details. Accurate.
- `docs/state-management.md` — Zustand stores in depth. Accurate.
- `docs/testing.md` — Playwright E2E guide. Accurate.
- `docs/audits/abend-handling.md` — Error handling audit. Current.
- `docs/audits/security-audit.md` — Security review. Current.
- `docs/audits/ssot-cleanup.md` — SSOT cleanup. Current.

## Verification Method

All claims in the rewritten `ARCHITECTURE.md` were verified against:

- `web/package.json` (versions, scripts)
- `web/src/stores/` (store files)
- `web/src/hooks/` (hook files)
- `web/src/app/api/` (API route directories)
- `web/src/lib/config.ts` (magic numbers)
- `web/src/realtime/transport.ts` (failover thresholds)
- `web/next.config.ts` (CSP, security headers)
- `.github/workflows/` (CI/CD pipeline)
