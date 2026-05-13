# Testing

Two test layers, both run from `web/`:

- **Vitest** — pure-logic and component unit tests under `web/tests/unit/`. Configured by `web/vitest.config.ts`. Uses `jsdom` + `@testing-library/react`.
- **Playwright** — E2E flows under `web/tests/` (excluding `unit/`). Two browser projects: desktop Chromium and mobile-viewport Chromium. Tests run against a live server on `localhost:3001`.

## Setup

```bash
cd web

# Install Playwright browsers once
npx playwright install chromium

# Vitest
npm run test:unit

# Playwright (auto-starts dev or `npm start` server via webServer config)
npm test
```

## Configuration

### Vitest (`web/vitest.config.ts`)

- Globs: `tests/unit/**/*.test.ts(x)`
- Setup file: `tests/unit/setup.ts` (`@testing-library/jest-dom` matchers, `fake-indexeddb`)
- Coverage: v8 provider, output to `web/coverage/`

### Playwright (`web/playwright.config.ts`)

- `testDir: ./tests`, `testIgnore: ['**/unit/**']` so Playwright never tries to load Vitest specs
- Base URL: `http://localhost:3001`
- Timeout: 30s per test, 10s per assertion
- Retries: 2 in CI, 0 locally
- Workers: full parallelism in CI, default locally
- Reporter: `[github, line]` in CI, HTML locally
- `webServer`: runs `npm run dev` (or `npm start` in CI), reuses existing server when present, sets `SCROLLDOWN_PLAYWRIGHT_WEB_SERVER=1` and forwards `SPORTS_DATA_API_KEY` / `SPORTS_API_KEY` / `API_KEY` from the parent shell

### Projects

| Name | Viewport | Notes |
|------|----------|-------|
| `setup` | — | Runs `tests/global-setup.ts` once |
| `chromium` | `Desktop Chrome` | Depends on `setup` |
| `mobile` | 390×844, `isMobile`, `hasTouch` | Chromium with mobile viewport (no WebKit dependency) |

`tests/global-setup.ts` and `tests/helpers.ts` are committed; the captured `tests/.auth/*` state (if any) is gitignored.

### Tags

`@smoke` — fast subset gated in PR CI. PR CI excludes `@live-upstream` (tests that need real upstream data such as live game schedules). The `@live-upstream` set runs daily via `.github/workflows/e2e-daily.yml`.

See `web/tests/SDA_HANDOFF.md` for fixture/handoff notes; `web/tests/MINIMAL_SDA_FIXTURES.md` documents the captured fixtures used by `/dev/catchup-lab` and the `tests/fixtures/` directory.

## Vitest Coverage

Unit tests live in `web/tests/unit/lib/`. To enumerate the current set:

```bash
ls web/tests/unit/lib
npx vitest list             # full test names per file
```

The directory is the source of truth; there is no hand-maintained mirror to keep in sync. Coverage today, grouped by surface:

| Surface | Specs |
|---------|-------|
| Proxy & networking | `api-server.test.ts`, `api.test.ts`, `rate-limit.test.ts` |
| MLB catch-up pipeline | `scroll-down-mlb-api.test.ts`, `scroll-down-mlb-deck-adapter.test.ts` (includes the score-monotonic suite from ISSUE-003), `leverage.test.ts`, `result-chip.test.ts`, `game-filters.test.ts` |
| Field visuals | `field-geometry.test.ts`, `runner-paths.test.ts`, `trajectory.test.ts` |
| Helpers / types | `date-utils.test.ts`, `types-status.test.ts`, `mlb-teams.test.ts`, `utils.test.ts` |
| SEO / site config | `seo.test.ts`, `site-config.test.ts` |
| Component | `top-banner-slot.test.tsx` |

Add new unit tests under `tests/unit/` — the Vitest config picks them up automatically.

## Playwright Coverage

E2E specs live under `web/tests/` (excluding `unit/`). The directory is the source of truth — there is no separate "expected suites" list to keep in sync. Browse `web/tests/` to see the current set, and use `--list` to enumerate:

```bash
npx playwright test --list
npx playwright test --list --grep "@smoke"
```

When adding a new spec, place it under a subdirectory matching the surface (e.g. `tests/catchup/`, `tests/home/`) and tag with `@smoke` if it needs to run on every PR.

## Resilience patterns

PRs run smoke against real upstream-derived data, so tests must handle environment variability:

- **No game data** — skip rather than fail when the API returns an empty schedule.
- **Slow upstream** — bound waits with the per-assertion 10s timeout; skip after a longer per-test timeout when the route is unresponsive.
- **`@live-upstream`** — gate any test that depends on a real live game schedule with this tag, so PR CI excludes it.

## NPM scripts (test only)

| Command | Purpose |
|---------|---------|
| `npm test` | Full Playwright suite |
| `npm run test:smoke` | `@smoke` tests only |
| `npm run test:smoke:pr` | `npm run build` then `@smoke` excluding `@live-upstream` (mirrors PR CI) |
| `npm run test:headed` | Playwright with visible browser |
| `npm run test:ui` | Playwright UI mode |
| `npm run test:unit` | Vitest (`--passWithNoTests`) |
| `npm run test:unit:watch` | Vitest watch mode |
| `npm run test:unit:coverage` | Vitest with v8 coverage |

## CI

Defined in `.github/workflows/ci.yml`:

- `web` job — runs `vitest run --coverage` on every push/PR (uploads `web-coverage` artifact).
- `playwright-smoke` job — runs `@smoke` excluding `@live-upstream` on every push/PR with secrets available; skipped on fork PRs.
- `e2e-daily.yml` — runs the full Playwright suite on a daily schedule.
