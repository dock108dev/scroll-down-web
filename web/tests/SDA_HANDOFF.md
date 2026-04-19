# SDA / upstream handoff — Playwright coverage map

This document is for the **sports data API (SDA)** team and for **scroll-down-web** maintainers. It lists **Next.js BFF routes** that Playwright exercises (directly or via the browser), how **CI** splits tests, and what is **out of scope** for SDA.

## CI policy (`@live-upstream`)

| Workflow | Command | Intent |
|----------|---------|--------|
| **PR CI** ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) `playwright-smoke`) | `npx playwright test --grep "@smoke" --grep-invert "@live-upstream"` | **UI/BFF smoke** without requiring live schedules, FairBet cards, or golf leaderboards from upstream. |
| **Daily** ([`.github/workflows/e2e-daily.yml`](../../.github/workflows/e2e-daily.yml)) | `npx playwright test` | **Full** suite including `@live-upstream` tests (still needs `SPORTS_DATA_API_KEY` where applicable). |

Tests whose **title or `test.describe` name** includes `@live-upstream` depend on **real (or production-like) upstream data** through the web BFF. They are **skipped in PR Playwright** by design so PRs are not blocked by SDA outages or empty slates.

**Tag rule:** add `@live-upstream` to any `test.describe` or `test(...)` that:

- Uses `waitForGameData()` / real `[data-testid='game-row']`, or  
- Loads `/fairbet` and asserts bet cards, EV, CLV, simulators, etc., or  
- Calls `GET /api/games`, `/api/golf/*`, `/api/history`, etc. expecting **non-empty** sports payloads, or  
- Otherwise **fails or skips** when upstream has no suitable games/odds.

Do **not** tag: pure **mocks** (`page.route`), **fixture POSTs** to `/api/ai/*`, auth/billing-only tests, or **request** checks that only assert HTTP status &lt; 500.

## Next.js `/api/*` routes referenced in Playwright (grep of `web/tests`)

Routes **explicitly** referenced in test source (strings, `page.route` patterns, or constants). The browser also triggers whatever the **page** fetches (e.g. `/` loads `/api/games`); those are listed under **implicit**.

### Explicit in tests

| Route prefix | Example / notes | Typical owner |
|--------------|-----------------|----------------|
| `/api/health` | Global setup, degraded-banner mocks | Web / ops |
| `/api/games` | `?limit=1`, list, ad placements; `**/api/games**` mocks | BFF → SDA |
| `/api/games/*` | Game detail, flow (via UI) | BFF → SDA |
| `/api/fairbet` | Odds page, errors mock `**/api/fairbet/**` | BFF → SDA |
| `/api/fairbet/odds` | Slow-network test continues real route | BFF → SDA |
| `/api/fairbet/live` | Freemium pro-gate API checks | BFF → SDA |
| `/api/golf/leaderboard` | Request + mock | BFF → SDA |
| `/api/golf/tournaments` | Tournaments + per-event leaderboard | BFF → SDA |
| `/api/history` | Phase9 history tier checks | BFF → SDA |
| `/api/auth/*` | send-link, verify, session, sign-out | Web |
| `/api/billing/*` | checkout, portal, webhook | Web + Stripe |
| `/api/sync/reveal` | Pro reveal sync | Web |
| `/api/story-feedback` | POST contract | Web |
| `/api/ai/story` | Story generation (fixtures / LLM) | Web (+ provider) |
| `/api/ai/verify` | Fact verification fixtures | Web |
| `/api/ai/salient-events` | Salient events fixtures | Web |
| `/api/analytics/batch-simulate-jobs` | Smoke status | Web / analytics backend |
| `/api/realtime/sse` | SSE connection tests | Web |

### Implicit (browser navigation)

Visiting **`/`**, **`/game/[id]`**, **`/fairbet`**, **`/golf`**, **`/history`**, etc. causes the client to call the same BFF routes the app uses in production (primarily **`/api/games`**, **`/api/fairbet/*`**, **`/api/golf/*`**, **`/api/history`**). Those flows are covered by **describe-level** `@live-upstream` tags on the heaviest specs (see grep in repo for `@live-upstream`).

### Full BFF surface (from `web/src/app/api/**/route.ts`)

For a complete route inventory (including analytics, simulator, webhooks), see the `route.ts` files under [`web/src/app/api/`](../src/app/api/). Playwright does not hit every route; SDA care is mainly **games**, **FairBet**, **golf**, **history**, and any shared **health** semantics.

## What to give the SDA repo

1. **This file** + [`MINIMAL_SDA_FIXTURES.md`](./MINIMAL_SDA_FIXTURES.md) (minimal shapes / invariants).  
2. **Failing test titles** from daily Playwright (copy from HTML report or CI log) — map title → route above.  
3. **Non-goals for SDA:** layout, focus order, Pro gate copy, PWA, Stripe billing UI, magic-link redirects — all **web-only**.

## Spec files using `@live-upstream`

Run `rg '@live-upstream' web/tests` for the exact list. As of this document, tags are applied on:

- **FairBet:** [`fairbet.spec.ts`](./fairbet.spec.ts), [`fairbet/phase9.spec.ts`](./fairbet/phase9.spec.ts), [`fairbet/odds.spec.ts`](./fairbet/odds.spec.ts), [`fairbet/explanation.spec.ts`](./fairbet/explanation.spec.ts), [`fairbet/book-comparison.spec.ts`](./fairbet/book-comparison.spec.ts), [`fairbet/source-attribution.spec.ts`](./fairbet/source-attribution.spec.ts), [`fairbet/parlay.spec.ts`](./fairbet/parlay.spec.ts)
- **Home / cache / perf:** [`home/game-list.spec.ts`](./home/game-list.spec.ts), [`home/live-badge.spec.ts`](./home/live-badge.spec.ts), [`home/freshness-label.spec.ts`](./home/freshness-label.spec.ts), [`home/pinning.spec.ts`](./home/pinning.spec.ts), [`home/reveal-persistence.spec.ts`](./home/reveal-persistence.spec.ts), [`cache/staleness.spec.ts`](./cache/staleness.spec.ts), [`performance/load-times.spec.ts`](./performance/load-times.spec.ts) (selected tests)
- **Game:** [`game/detail.spec.ts`](./game/detail.spec.ts), [`game/timeline.spec.ts`](./game/timeline.spec.ts), [`game/team-stats.spec.ts`](./game/team-stats.spec.ts), [`game/reading-position.spec.ts`](./game/reading-position.spec.ts), [`game/bet-outcome.spec.ts`](./game/bet-outcome.spec.ts), [`game/player-stats.spec.ts`](./game/player-stats.spec.ts), [`game/source-attribution.spec.ts`](./game/source-attribution.spec.ts), [`game/ai-story-e2e.spec.ts`](./game/ai-story-e2e.spec.ts) (one describe)
- **Golf / history:** [`golf/leaderboard.spec.ts`](./golf/leaderboard.spec.ts), [`golf/tournaments.spec.ts`](./golf/tournaments.spec.ts), [`history/history-page.spec.ts`](./history/history-page.spec.ts)
- **Ads / mobile / tier / realtime:** [`ads/ad-placements.spec.ts`](./ads/ad-placements.spec.ts), [`mobile/responsive.spec.ts`](./mobile/responsive.spec.ts), [`freemium/tier-gating-suite.spec.ts`](./freemium/tier-gating-suite.spec.ts), [`realtime/trust.spec.ts`](./realtime/trust.spec.ts) (selected tests)
