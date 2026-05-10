# Docs Consolidation Pass — 2026-05-09

Scope: full sweep of every Markdown file in the repo against the live code at the working tree of `main`. Goal — every doc statement must be verifiable from code / config / CI. Anything wrong, outdated, duplicated, or pointing at a file that no longer exists was rewritten in place or deleted.

This pass overwrites the prior `docs/audits/docs-consolidation.md` (2026-04-28). The prior pass was written before the MLB-only pivot landed; almost every doc had drifted into a different product than the one in source.

## Trigger

`d084aaa feat: MLB-focused overhaul (catchup flow, dev tooling)` (the latest commit on `main`) deleted the multi-sport / FairBet / golf / billing / AdSense / magic-link surfaces. The docs were never updated. This pass replaces every doc statement that references those removed surfaces.

## Verification

Markdown-only pass; no source edits. The standard checks were not re-run (out of scope for a docs pass and the working tree contains in-flight edits from other passes).

| Check                 | Result                                |
|-----------------------|---------------------------------------|
| `npx tsc --noEmit`    | not run (docs-only)                   |
| `npm run lint`        | not run (docs-only)                   |
| `npm run test:unit`   | not run (docs-only)                   |

## Files touched

### Deleted

| Path                       | Reason |
|----------------------------|--------|
| `docs/realtime.md`         | The codebase has no realtime layer at all. There is no `web/src/realtime/`, no WebSocket transport, no SSE proxy, no dispatcher. `useGamesList` and `useCatchupCards` poll `/api/*` only. Every concrete claim in this file was unverifiable. |
| `docs/client-logic.md`     | Of 37 numbered "patterns," roughly 32 referenced removed surfaces (FairBet client filtering / sorting / pagination, parlay math, EV color mapping, score reveal store, snapshots, reading position, IndexedDB reveal store, golf, sportsbook attribution, preference sync, history page, AI story tracking). The handful that remained accurate were already covered by `architecture.md` / `state-management.md`. Net redundancy + falsehood. |
| `docs/roadmap.md`          | The implementation roadmap mapped to FairBet / billing / golf / AI story / freemium / Pro tier / CLV — none of which exist. The customer-voice direction lives in `BRAINDUMP.md` (broadcast-machine phase) and the granular tracked work lives in `.aidlc/issues/`. A hand-maintained third roadmap file would only drift again. |

### Rewritten

| Path | Old shape | New shape |
|------|-----------|-----------|
| `README.md` (root) | Promised a multi-sport feed + FairBet + golf product, listed an `ADS_SETUP.md` doc that doesn't exist. | One paragraph on the MLB catch-up product, run-locally, deployment pointer, doc index pointing only at files that exist. |
| `docs/README.md` | Indexed `realtime.md`, `client-logic.md`, `ADS_SETUP.md`, `roadmap.md` — three of which I deleted and one of which never existed. | Re-indexed to the surviving doc set. Added a "Customer-voice / Roadmap" section pointing at `BRAINDUMP.md` and `.aidlc/issues/`. |
| `docs/architecture.md` | 27 KB describing `/api/games`, `/api/fairbet/*`, `/api/golf/*`, `/api/analytics/*`, `/api/simulator/*`, `/api/auth/*`, `/api/billing/*`, `/api/sync/*`, `/api/ai/*`, `/api/realtime/sse`; 14 Zustand stores; 16 hooks; preference sync; auth proxy whitelist + rate limiting; AdSense CSP; Stripe; PWA; AI story; multi-sport simulators. | Verified inventory of what actually ships: 6 API routes (`health`, `games/recent`, `games/[id]/cards`, `games/[id]/summary`, `dev/fixtures`, `dev/fixtures/[id]/cards`), 3 stores, 3 hooks, the catch-up pipeline, the actual CSP, the actual env coupling. Directory tree matches `web/src/`. |
| `docs/design.md` | Mixed real principles with FairBet card structure, parlay UI, sportsbook chips, Following Live, AI story typography, etc. | Kept the spirit (trust, restraint, motion = life), reframed for the broadcast-machine identity in `BRAINDUMP.md`. Patterns section shows the actual store/`apiFetch`/catch-up shape. Anti-patterns were rewritten to forbid what would now be harmful (introducing a fourth store, bypassing `apiFetch`, hand-tuned field geometry). |
| `docs/development.md` | QA checklist had ~150 items: home page league filters, multi-sport simulators, MLB PA Simulator, FairBet, history, golf, magic-link auth, billing, preference sync. | QA checklist now mirrors what a tester can actually do: home, catch-up viewer, onboarding, settings, `/dev/catchup-lab`, PWA. Common-issues section trimmed to actual failure modes (502 mapping, Playwright env shortcut leaking into dev shell, SW pollution on localhost, empty deck debug path). |
| `docs/deployment.md` | Mostly accurate on Docker / CI / Hetzner mechanics, but listed `MAGIC_LINK_FROM_EMAIL` and a magic-link feature that doesn't exist. | Same Docker/CI/Hetzner story (verified against `web/Dockerfile`, `web/docker-compose.yml`, `.github/workflows/ci.yml`, `.github/workflows/promote-prod.yml`). Added an explicit "build-time vs runtime env" note that the `NEXT_PUBLIC_ADSENSE_*` build-args wired in CI are accepted by the Dockerfile but not consumed by application code today, and that `MAGIC_LINK_SECRET` similarly has no reader. |
| `docs/testing.md` | Listed 19 Playwright suites that no longer exist (ads, auth, fairbet, freemium, golf, history, analytics, profile, sync, etc.) plus a long `data-testid` table for components that don't exist. | Replaced with the actual config (Vitest + Playwright, `testIgnore: ['**/unit/**']`, two browser projects), an enumeration of the real Vitest specs under `tests/unit/lib/`, and a pointer to `npx playwright test --list` for the live E2E set rather than a hand-maintained mirror. |
| `docs/state-management.md` | Documented 14 stores including `auth`, `session`, `tier`, `pro-gate-sheet`, `my-bets`, `reveal`, `pinned-games`, `reading-position`, `section-layout`, `home-scroll`, `ui`, plus a "preference sync" architecture. | Three stores: `useSettings` (v2 + migration), `useOnboarding`, `useCatchupProgress`. Verbatim shapes from the source files, including the v1→v2 migration list. Added a "what is **not** in a store" section so readers don't search for a missing reveal/auth/realtime store. |
| `docs/env-and-config.md` | Multi-sport CSP, AnthropicAPIKey, Stripe keys, MagicLinkSecret, DATABASE_URL, AdSense slots, FAIRBET / FRESHNESS / AI_STORY / FEATURE_GATES / AUTH / ADS / VALIDATION / RENDER / HEADLINE_STATS sections all documented as canonical. | Only the constants that exist in `web/src/lib/config.ts` today: `BACKEND_BASE_URL`, `LEAGUE`, `POLLING`, `API`, `LAYOUT`, `STORAGE_KEYS`, `PWA`, `STORAGE`, `ATTRIBUTION`, `CATCHUP`, `BOX_SCORE`, `DEFAULTS`, `isPlaywrightServerEnv()`. Env-var table cross-checked against `web/.env.local.example`, `web/.env.production.example`, `web/src/lib/api-server.ts`, `web/src/lib/site-config.ts`, `web/src/lib/public-url.ts`. Added a "currently-defined-but-unused" subsection for the AdSense / magic-link plumbing that survives in CI. |
| `docs/PROD_PROMOTION_AND_COM_SETUP.md` | Bootstrap guide with magic-link sender override env vars and an "AdSense + `.com`" verification step. | Same bootstrap guide minus the references to features the app no longer has. AdSense section reframed as "reserved (formerly AdSense)" pointing at `deployment.md` for the no-op build-arg note. |

### Untouched

| Path | Reason |
|------|--------|
| `BRAINDUMP.md` (root) | Customer-voice doc. Per pass rules, never rewritten. |
| `docs/aidlc-futures.md` | Auto-generated by `aidlc run`, superseded each run. Touching it would be lost on the next finalization. |
| `docs/audits/cleanup-report.md`, `error-handling-report.md`, `security-report.md`, `ssot-report.md` | Each is owned by another finalization pass on this same branch (visible as `M` in `git status`). Per the "act or justify in your own pass's scope" rule, I do not edit other passes' reports. The links from `docs/README.md` to these files were verified to still resolve. |
| `.github/`, `web/.env.*.example`, `web/src/**` | Out of scope for a docs pass. |

## Statements removed as unverifiable

A representative slice — there were too many to enumerate exhaustively, but every claim that survived in the rewritten files was verified against a specific file in `web/src/` or a workflow in `.github/`.

| Statement (paraphrased, removed) | Why unverifiable |
|---|---|
| "Three-tier transport with automatic failover (WebSocket → SSE → polling)" | No `web/src/realtime/` directory; no `EventSource`, `WebSocket`, or `wss://` usage anywhere in `web/src/`. |
| "Auth proxy path whitelist: login / signup / me / refresh / forgot-password / reset-password / magic-link / magic-link/verify" | No `/api/auth/*` route handlers exist in `web/src/app/api/`. |
| "Stripe Checkout / Customer Portal / webhook routes" | No `/api/billing/*` route handlers; no `stripe` dependency in `web/package.json`. |
| "Pro feature gates: `live_odds`, `full_fairbet`, `all_books`, `all_markets`, `cross_device_sync`, `advanced_filters`, `line_movement`, `ev_simulator`, `clv_tracking`, `win_probability`, `history`" | `FEATURE_GATES` is not exported from `web/src/lib/config.ts`. |
| "AdSense slot components `FeedAd`, `GameDetailAd`, `FairBetAd`; SSOT in `lib/ads/`" | No `web/src/lib/ads/` directory; no `components/ads/` directory. |
| "AI story routes `/api/ai/story`, `/api/ai/salient-events`, `/api/ai/verify` using `claude-haiku-4-5-20251001`" | No `/api/ai/*` route handlers; no `@anthropic-ai/sdk` dependency. |
| "Sports supported: NBA, NCAAB, NFL, NCAAF, MLB, NHL, PGA Tour" | `LEAGUE = "mlb"` (`web/src/lib/config.ts:10`); the cards/summary proxy returns 404 for non-MLB games. |
| "Golf routes `/api/golf/tournaments`, `/api/golf/tournaments/[eventId]/leaderboard`" | No `/api/golf/*` route handlers; no golf components or hooks. |
| "Analytics admin routes (17 endpoints) under `/api/analytics/*`" | No `/api/analytics/*` route handlers. |
| "Stores: `auth`, `session`, `tier`, `pro-gate-sheet`, `my-bets`, `reveal`, `pinned-games`, `reading-position`, `section-layout`, `home-scroll`, `ui`, `game-data`, `game-core`" | None of these files exist under `web/src/stores/`; the directory contains exactly `settings.ts`, `onboarding.ts`, `catchup-progress.ts`. |
| "CSP allows `partners.draftkings.com`, `affiliates.betmgm.com`, `pagead2.googlesyndication.com`, `js.stripe.com`, ..." | `web/next.config.ts` allows only `'self'`, `https://plausible.io`, `https://sda.dock108.dev`, `wss://sda.dock108.dev` (plus dev-only loopback). |
| "PWA install prompt + reveal IDB + offline queue + cross-device sync" | Install prompt and offline banner exist. There is no IndexedDB reveal store, no offline queue, no sync. |
| "Multi-sport simulators at `/analytics/nba`, `/analytics/nhl`, `/analytics/ncaab`" | No `/analytics/*` routes. |
| "Magic-link send/verify/session/sign-out routes; 30-day session cookie; 15-min token TTL" | No `/api/auth/*` route handlers. The `MAGIC_LINK_BASE_URL` env name still survives in `lib/public-url.ts` as a legacy alias for `PUBLIC_BASE_URL`, which is acknowledged in the rewritten `env-and-config.md`. |

## Stale comment in source (escalation)

`web/src/lib/public-url.ts:6-7` carries a docstring referencing magic-link emails and Stripe success/cancel/return URLs — neither of which exist in this repo. The rest of the docstring (host-header injection rationale) is still accurate, and the `MAGIC_LINK_BASE_URL` env-var alias is a real fallback consumers depend on.

- **Smallest concrete next action:** edit the docstring opening from "Resolve the public origin for outbound URLs that we hand to third parties (magic-link emails, Stripe success/cancel/return URLs)." to "Resolve the public origin for outbound URLs that we hand to third parties or surface in metadata." Keep the rest. This is a **code edit**, not a docs edit, so it is out of scope for this docs pass.
- **Who unblocks it:** any code-cleanup / SSOT pass that touches `web/src/lib/public-url.ts`. The next AIDLC finalization with `cleanup` or `ssot` finalization scope can take it.

## Intentional gaps

| Gap | Reason |
|-----|-------|
| No "API reference" doc with curl examples per route. | The six routes are tightly coupled to upstream and authenticated server-side; an external reference would invite leaks. The route table in `architecture.md` is sufficient. |
| No design tokens / CSS variable doc. | The `BRAINDUMP.md` direction is still in flux on theming (see "broadcast monitor" / "phosphor wobble" notes). Documenting tokens before they're stable would just create another file to rewrite. |
| No catch-up algorithm whitepaper. | The pipeline is documented at the level a contributor needs (selection → planning → render). Deeper math is in `web/src/lib/catchup-cards.ts` and `web/src/lib/rhythm-planner.ts` source comments + Vitest specs. |

## Result

Working tree contains:

- `README.md` — rewritten (52 lines)
- `docs/README.md` — rewritten
- `docs/architecture.md` — rewritten
- `docs/design.md` — rewritten
- `docs/development.md` — rewritten
- `docs/deployment.md` — rewritten
- `docs/testing.md` — rewritten
- `docs/state-management.md` — rewritten
- `docs/env-and-config.md` — rewritten
- `docs/PROD_PROMOTION_AND_COM_SETUP.md` — edited (3 sections)
- `docs/audits/docs-consolidation.md` — this report (overwrites the 2026-04-28 version)
- `docs/realtime.md` — deleted
- `docs/client-logic.md` — deleted
- `docs/roadmap.md` — deleted
- `BRAINDUMP.md`, `docs/aidlc-futures.md`, `docs/audits/{cleanup,error-handling,security,ssot}-report.md` — untouched

Every statement in the surviving docs is grounded in a specific file under `web/src/`, a workflow under `.github/`, an env-example file, or `web/package.json`.
