# Playwright lanes

Three workflows run the suite:

| Workflow | Command | Tag policy |
|----------|---------|------------|
| **PR CI** ([`ci.yml`](../../.github/workflows/ci.yml) `playwright-smoke`) | `npx playwright test --grep "@smoke" --grep-invert "@live-upstream"` | UI/BFF smoke. Every test mocks `/api/games/*` via `page.route` so it works without the real upstream. |
| **PR coverage** ([`ci.yml`](../../.github/workflows/ci.yml) `playwright-coverage`) | same, with `SCROLLDOWN_E2E_COVERAGE=1` | Collects v8 JS coverage via [monocart-reporter](https://github.com/cenfun/monocart-reporter), enforces ≥80% lcov line coverage, uploads `coverage-e2e/` (lcov + HTML). |
| **Daily** ([`e2e-daily.yml`](../../.github/workflows/e2e-daily.yml)) | `npx playwright test` | Full suite, including `@live-upstream` tests that hit the real SDA upstream through the BFF. |

## Local coverage

```sh
npm run test:e2e:coverage   # builds with sourcemaps + runs smoke with monocart
open coverage-e2e/index.html
```

The reporter prints a six-axis summary on stdout (Bytes / Statements / Branches / Functions / Lines / inline). lcov line coverage gates CI; the other metrics are informational. `productionBrowserSourceMaps` is only enabled when `SCROLLDOWN_E2E_COVERAGE=1`, so real production builds stay map-free.

## Tag rules

- `@smoke` — runs on every PR. Must work without real upstream data (mock with `page.route`, or only hit endpoints that don't proxy: `/api/health`, `/api/games/[id]/...` with an invalid id, etc.).
- `@live-upstream` — daily only. Expects real SDA payloads via `SPORTS_DATA_API_KEY`. Skipped in PR Playwright by design so PRs aren't blocked by upstream outages or empty slates (off-season, etc.). Use `test.skip()` if a real call returns zero rows so the daily passes during dead weeks.

## BFF routes referenced in tests

| Route | Notes |
|-------|-------|
| `/api/health` | Returns `{status:"ok"}` immediately when `SCROLLDOWN_PLAYWRIGHT_WEB_SERVER=1` (set by `playwright.config.ts`). |
| `/api/games/recent` | Spoiler-safe list. Mocked everywhere except `live-upstream.spec.ts`. |
| `/api/games/[id]/cards` | Deck for a single game. Validates `gameId` against `^[A-Za-z0-9_-]+$` and 400s otherwise. |
| `/api/games/[id]/summary` | Reveal payload. 409 when SDA reports the reveal isn't ready yet. |

See [`web/src/app/api/`](../src/app/api/) for the full route inventory.

## File map

- `helpers.ts` — fixture builders + `seedOnboarding` / `seedCatchupProgress`.
- `home.spec.ts`, `catchup-final.spec.ts`, `catchup-live.spec.ts`, `catchup-errors.spec.ts`, `catchup-field.spec.ts`, `onboarding.spec.ts`, `settings.spec.ts`, `static-pages.spec.ts`, `api-contracts.spec.ts` — all `@smoke`, all mocked.
- `live-upstream.spec.ts` — `@live-upstream`, daily-only.
- `unit/**` — Vitest unit tests (excluded from Playwright via `testIgnore`).
- `fixtures/games/`, `fixtures/snapshots/` — JSON snapshots of real games kept for unit tests of `lib/adapters/*`. Not loaded by E2E.
