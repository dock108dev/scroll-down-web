# Docs Consolidation Audit

**Date**: 2026-04-18 (Round 1), updated 2026-04-18 (Round 2)

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

---

## Round 2 — 2026-04-18

Full documentation audit against current codebase. The previous round left a significant gap: billing, magic-link auth, PWA, AI story, and ads infrastructure were all implemented in code but absent from every doc file.

### ARCHITECTURE.md — Updated

**New API routes documented**:
- Local auth routes (magic-link system): `send-link`, `verify`, `session`, `sign-out` — these are direct Next.js routes, not proxied to the backend
- AI story routes: `/api/ai/story`, `/api/ai/salient-events`, `/api/ai/verify`, `/api/story-feedback`
- Billing routes: `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/webhook`

**New Zustand stores** (3 undocumented stores added to table):
- `session` — HttpOnly cookie session state (magic-link system)
- `tier` — free/pro tier tracking + anonymous ID + `isAllowed()` gate
- `pro-gate-sheet` — ephemeral UI state for Pro upgrade bottom sheet

**Analytics tabs**: Added Forecasts tab (`/analytics/forecasts`, admin role).

**Auth section**: Restructured to document both systems. The legacy JWT proxy and the new magic-link/session-cookie system now coexist. The proxy path whitelist and rate limits apply only to the legacy JWT flow.

**CSP**: Updated to reflect actual `next.config.ts`. Previously documented as connecting only to `sda.dock108.dev` and `plausible.io`. Actual CSP also allows `partners.draftkings.com`, `affiliates.betmgm.com` (script + connect), and Stripe domains (`api.stripe.com`, `js.stripe.com`, `hooks.stripe.com`). The `'unsafe-inline'` on scripts is an open risk documented in the security audit (R-4).

**Directory structure**: Added `components/ads/`, `components/auth/SessionProvider`, `components/layout/` additions (BetaBanner, OfflineBanner, PWAInstallPrompt, RevealIDBProvider), `components/fairbet/` additions (BookChip, BookComparisonRow, ProGateSheet), `components/game/GameStorySection`, `features/analytics/services/` additions (ForecastsService, ProfilesService). Store count corrected from 10 to 13.

**New sections added**: "Billing & Freemium Tier" and "AI Game Story" — both document infrastructure that is live in code but was entirely absent from documentation.

### CLAUDE.md — Fixed

`cp .env.example .env.local` corrected to `cp .env.local.example .env.local` (filename mismatch with README.md and development.md).

### docs/state-management.md — Updated

Three new stores documented in detail: `session`, `tier`, `pro-gate-sheet`. Includes field descriptions, action signatures, and dev override behavior (`?tier=pro` query param).

Note: `reveal` store now persists to IndexedDB (via `RevealIDBProvider`) in addition to localStorage. Table updated to reflect this.

### docs/env-and-config.md — Updated

**New optional env vars**: `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MAGIC_LINK_SECRET`, `DATABASE_URL`.

**New config sections documented** (all previously missing):
- `FAIRBET` — EV tier thresholds, attribution freshness/staleness windows
- `FRESHNESS` — freshness label timing thresholds
- `RENDER` — FairBet batch render size
- `VALIDATION` — email regex, password min length
- `ATTRIBUTION` — data source label
- `AI_STORY` — banned phrases, sentence budgets, model name, quality gate
- `FEATURE_GATES` — canonical Pro feature keys
- `AUTH` — magic-link token TTL, session lifetime, rate limits
- `ADS` — native ad interval, banner dimensions
- `DEFAULTS` — home page, timeline, odds format, theme, abbreviation fallbacks
- `HEADLINE_STATS` — per-sport collapsed stat labels
- `PWA` — install prompt session threshold, offline banner dismiss delay

**Additional localStorage keys**: `sd-tier`, `sd-anon-id`, `sd-session`, `sd-onboarding-seen`, `sd-pwa-install-dismissed`, `sd-pwa-session-count`.

### ROADMAP.md — Updated

Phases 5, 6, and 7 previously showed all items as unchecked when substantial infrastructure was already implemented. Updated to mark completed items with `[x]` and add status notes.

- **Phase 5 (AI Story)**: 7 of 9 items complete. Infrastructure is done; quality gate (`STORY_QUALITY_GATE = true`) blocks public exposure until 50+ story review passes.
- **Phase 6 (PWA)**: 4 of 8 items complete. Service worker, IndexedDB reveal persistence, offline banner, and install prompt are live. Background sync and cross-device sync are not yet implemented.
- **Phase 7 (Freemium)**: 5 of 8 items complete. Tier system, feature gates, Stripe billing, Pro gate sheet, and ads components are live. Ad placement enforcement and "see what you're missing" preview are not yet done.

### AIDLC_FUTURES.md — Archived

Moved from root to `docs/archived/aidlc-futures.md`. This file is auto-generated process tracking from the AIDLC tool, not developer documentation. It does not belong in the root alongside README, ARCHITECTURE, DESIGN, and ROADMAP.

### docs/README.md — Updated

Added `archived/aidlc-futures.md` to the Archived table.

### What Was Not Changed

Files verified accurate and left untouched:
- `DESIGN.md` — Design principles and patterns
- `docs/client-logic.md` — 37 client-side patterns
- `docs/development.md` — Local setup and QA checklist
- `docs/deployment.md` — Docker, CI/CD, Hetzner
- `docs/realtime.md` — Realtime transport details
- `docs/testing.md` — Playwright E2E guide
- `docs/audits/abend-handling.md` — Error handling audit
- `docs/audits/security-audit.md` — Security review
- `docs/audits/ssot-cleanup.md` — SSOT cleanup
- `docs/audits/cleanup-report.md` — Code quality cleanup

---

## Round 3 — 2026-04-18

Full audit + consolidation pass. The main structural change is enforcing "README.md at root, everything else in /docs."

### Files Moved to /docs

| Old Path | New Path | Changes |
|----------|----------|---------|
| `ARCHITECTURE.md` | `docs/architecture.md` | Updated with gaps (see below) |
| `DESIGN.md` | `docs/design.md` | Updated reveal state note (IDB) |
| `ROADMAP.md` | `docs/roadmap.md` | Updated research index path to `archived/research/` |

`BRAINDUMP.md` was listed in the root docs/README.md but did not exist on disk — no action needed.

### README.md (root) — Rewrote

Now a minimal quick-start pointing to `/docs` for all detail. Corrected env file command (standardized to `cp .env.local.example .env.local`).

### docs/README.md — Updated

Moved architecture/design/roadmap entries from "Root-Level Docs" table into a new "Architecture & Design" section reflecting their new location. Added `docs-consolidation.md` to the audits table.

### docs/architecture.md — Updated (moved from ARCHITECTURE.md)

**Added missing API routes:**
- `GET /api/history` — historical game list with pagination
- `GET /api/analytics/forecasts/mlb` — MLB forecast data (admin)
- `GET /api/billing/info` — billing and subscription status
- `POST /api/sync/reveal` — Pro-tier cross-device reveal sync

**Added missing Zustand store:**
- `my-bets` (key: `sd-my-bets`, max 200 bets) — user's saved bets and outcomes

**Added missing hook:**
- `useProGate` — evaluates Pro feature gates for a given key

**Fixed stale path:**
- Directory structure listed `profile/` as the user account page; corrected to `account/`

**Added to directory structure:**
- `app/settings/my-bets/` — bet tracker sub-pages
- `components/account/` — AccountContent
- `components/history/` — HistoryGateOverlay
- Updated store count: 13 → 14, hook count: 14 → 15

**Added new top-level sections:**
- "My Bets Tracker" — documents `/settings/my-bets`, `my-bets` store, backend routes
- "PWA & Offline" — consolidates PWA status that was scattered in roadmap

**Other fixes:**
- Feature gates list updated to all 11 keys (was listing 6)
- Billing section mentions `/api/billing/info`
- `robots.ts` entry corrected: `/profile` → `/account`
- Reveal state persistence note updated to IndexedDB

### docs/design.md — Updated (moved from DESIGN.md)

Score Reveal Interaction pattern step 5: "localStorage" → "IndexedDB" (matches actual `lib/reveal-idb.ts`).

### docs/roadmap.md — No content changes (moved from ROADMAP.md)

Research index path updated: `docs/research/` → `docs/archived/research/` to match actual archive location.

### Nothing Deleted in /docs

All existing docs in `/docs` were accurate and useful. No files deleted from the `/docs` directory.

### Gaps Found and Addressed

| Gap | Resolution |
|-----|-----------|
| `/api/history` route undocumented | Added to architecture.md |
| `/api/analytics/forecasts/mlb` undocumented | Added to architecture.md |
| `/api/billing/info` undocumented | Added to architecture.md |
| `/api/sync/reveal` undocumented | Added to architecture.md |
| `my-bets` store undocumented | Added to architecture.md |
| `useProGate` hook undocumented | Added to architecture.md |
| `/account` listed as `/profile/` | Fixed in architecture.md |
| `/settings/my-bets/` pages unlisted | Added to architecture.md |
| `components/account/` unlisted | Added to architecture.md |
| `components/history/` unlisted | Added to architecture.md |
| Feature gates listed incompletely (6/11) | All 11 keys now listed |
| PWA status scattered in roadmap only | New "PWA & Offline" section in architecture.md |
