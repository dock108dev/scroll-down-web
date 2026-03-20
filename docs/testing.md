# Testing

## Overview

End-to-end tests use Playwright with three browser projects: desktop Chromium, mobile-viewport Chromium (390x844, touch enabled), and an audit project (always-on screenshots/video). Tests run against a live dev server on `localhost:3001`.

## Setup

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Start the dev server in another terminal
npm run dev

# Run all tests
npm test

# Run with visible browser
npm run test:headed

# Run Playwright UI mode
npm run test:ui
```

## Configuration

`playwright.config.ts` defines:

- **Global setup**: creates a test account via signup, saves auth state to `tests/.auth/user-state.json`
- **Desktop project** (`chromium`): default viewport
- **Mobile project** (`mobile`): 390x844 viewport, touch enabled, Chromium (not WebKit)
- **Audit project** (`audit`): matches `audit/*.spec.ts`, always captures screenshots and video, no retries
- **Base URL**: `http://localhost:3001`
- **Timeout**: 30s per test
- **Retries**: 2 in CI, 0 locally (audit project always 0)

## Auth Pattern

Tests that need authentication use the `authedPage` fixture, which loads saved auth state from the global setup run. The `page` fixture is unauthenticated.

```typescript
import { test, expect } from "../helpers";

test("requires auth", async ({ authedPage }) => {
  // authedPage is logged in
});

test("no auth needed", async ({ page }) => {
  // page is a guest
});
```

### Auth Staleness

If the backend restarts between test runs, the saved JWT becomes invalid. Tests that depend on auth detect this (redirect to `/login`) and skip gracefully rather than fail. To force fresh auth:

```bash
rm -f tests/.auth/user-state.json
npm test
```

## Test Helpers

`tests/helpers.ts` exports:

| Helper | Purpose |
|--------|---------|
| `waitForLoad(page)` | Waits for skeleton loaders to disappear |
| `waitForGameData(page, timeout?)` | Waits for game rows to appear; returns `false` if API unavailable |
| `waitForHealthy(page)` | Hits `/api/health`, asserts app is responding |
| `screenshotPage(page, name)` | Full-page screenshot to `audit-results/screenshots/` |
| `collectPerformanceMetrics(page)` | Navigation Timing API metrics (TTFB, DCL, load, interactive) |
| `measureMs(fn)` | Times an async operation in milliseconds |
| `loginViaUI(page, email, password)` | Fills login form and submits |
| `signupViaUI(page, email, password)` | Fills signup form and submits |
| `getAuthToken(page)` | Reads JWT from localStorage |
| `clearAppState(page)` | Clears localStorage and sessionStorage |

## Test Suites

### Feature Tests

| Directory | Tests | Notes |
|-----------|-------|-------|
| `tests/auth/` | Signup, login, logout, magic link, forgot password | Creates fresh accounts per test |
| `tests/home/` | Game list, pinning, score reveal | Skips gracefully if no game data |
| `tests/game/` | Detail page, reading position | Navigates via game row click |
| `tests/fairbet/` | Odds display, live tab, parlay builder | Skips if API slow (>20s) |
| `tests/golf/` | Tournament list, leaderboard display | Skips if golf API unavailable |
| `tests/history/` | Date navigator, search, auth gate | Tests both admin and guest access |
| `tests/analytics/` | Tab navigation, models page, batch simulation | Permission checks |
| `tests/errors/` | 404 handling, API error resilience | Route interception for 500s/timeouts |
| `tests/profile/` | Account info, password change, delete account | Skips if auth expired |
| `tests/mobile/` | Bottom tabs, responsive layout | Mobile viewport (390x844) |
| `tests/performance/` | Page load times, navigation speed | Threshold-based assertions |
| `tests/cache/` | LocalStorage staleness, tab visibility | Simulates visibility changes |
| `tests/realtime/` | SSE endpoint connectivity | Verifies proxy responds |
| `tests/settings/` | Theme, score reveal mode, odds format | Toggles settings and verifies |

### Audit Suite

The audit project (`tests/audit/`) runs separately with `npm run test:audit`. Always captures screenshots and video. No retries.

| Test File | Purpose |
|-----------|---------|
| `crawl-all-pages.spec.ts` | Full-page screenshots, performance timing, console errors, broken images, overflow detection |
| `api-validation.spec.ts` | Validates 15+ API endpoints for status, JSON shape, and response time |
| `data-accuracy.spec.ts` | Cross-references API data with UI rendering (scores, team names, tournament names) |
| `error-scenarios.spec.ts` | 404 pages, nonexistent IDs, network failures via route interception |
| `performance-benchmarks.spec.ts` | LCP, CLS via PerformanceObserver, outputs JSON to `audit-results/` |
| `visual-regression.spec.ts` | Desktop + mobile screenshot comparison with 0.2% pixel diff tolerance |
| `accessibility.spec.ts` | Alt text, accessible names, focus order |

Audit results are written to `web/audit-results/` (gitignored).

## Resilience Patterns

Tests are designed to handle environment variability:

- **No game data**: tests using `waitForGameData()` skip with `test.skip(true, "No game data")` instead of failing
- **Slow API**: FairBet tests catch timeouts and skip when the API doesn't respond within 20s
- **Stale auth**: profile tests detect redirect to `/login` and skip
- **Backend down**: signup/login tests skip when the backend doesn't respond within 15s
- **Missing golf data**: golf tests skip when tournament API returns empty results

## Data-testid Attributes

Components expose `data-testid` attributes for stable test selectors:

### Layout
| Attribute | Component |
|-----------|-----------|
| `top-nav` | TopNav |
| `bottom-tabs` | BottomTabs |
| `search-bar` | SearchBar |

### Home
| Attribute | Component |
|-----------|-----------|
| `game-row` | GameRow |
| `pinned-bar` | PinnedBar |
| `pinned-chip` | PinnedBar (each chip) |
| `league-filter` | Home page |
| `page-home` | Home page root |

### Game Detail
| Attribute | Component |
|-----------|-----------|
| `page-game-detail` | Game detail page root |
| `game-header` | GameHeader |
| `section-nav` | SectionNav |
| `stats-section` | PlayerStatsSection |
| `odds-section` | OddsSection |
| `timeline-section` | TimelineSection |
| `mini-box-score` | MiniBoxScore |
| `mini-scorebar` | MiniScorebar |
| `player-stats-table` | PlayerStatsTable |
| `wrap-up-section` | WrapUpSection |
| `pregame-buzz-section` | PregameBuzzSection |
| `flow-container` | FlowContainer |
| `flow-block-card` | FlowBlockCard |

### FairBet
| Attribute | Component |
|-----------|-----------|
| `page-fairbet` | FairBet page root |
| `bet-card` | BetCard |
| `live-odds-panel` | LiveOddsPanel |
| `parlay-sheet` | ParlaySheet |
| `book-filters` | BookFilters |

### Golf
| Attribute | Component |
|-----------|-----------|
| `page-golf` | Golf page root |
| `page-golf-event` | Golf event page root |
| `tournament-card` | TournamentCard |
| `leaderboard` | Leaderboard |
| `leaderboard-row` | LeaderboardRow |

### Shared
| Attribute | Component |
|-----------|-----------|
| `loading-skeleton` | LoadingSkeleton (default variant) |
| `auth-gate` | AuthGate (when gated) |
| `settings-content` | SettingsContent |
| `page-history` | History page root |

## Running in CI

The CI pipeline runs Playwright smoke tests (`@smoke`-tagged) on every push via the `playwright-smoke` job in `.github/workflows/ci.yml`. A separate daily workflow (`.github/workflows/e2e-daily.yml`) runs the full Playwright suite at 6 AM UTC. Both produce `playwright-report` artifacts.

The agent audit workflow (`.github/workflows/agent-audit.yml`) runs the audit project weekly on Mondays and can be triggered manually via `workflow_dispatch`. It builds the app, runs audit tests, generates a markdown report, and files GitHub issues for failures.

## NPM Scripts

| Command | Purpose |
|---------|---------|
| `npm test` | All Playwright tests |
| `npm run test:smoke` | Smoke tests only (`@smoke` tag) |
| `npm run test:headed` | Tests in visible browser |
| `npm run test:ui` | Playwright UI mode |
| `npm run test:audit` | Audit project tests only |
| `npm run test:audit:report` | Audit tests + JSON output + markdown report |
