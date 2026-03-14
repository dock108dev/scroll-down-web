# Testing

## Overview

End-to-end tests use Playwright with two browser projects: desktop Chromium and a mobile-viewport Chromium (390x844, touch enabled). Tests run against a live dev server on `localhost:3001`.

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
- **Base URL**: `http://localhost:3001`
- **Timeout**: 30s per test
- **Retries**: 2 in CI, 0 locally

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
| `measureMs(fn)` | Times an async operation in milliseconds |
| `loginViaUI(page, email, password)` | Fills login form and submits |
| `signupViaUI(page, email, password)` | Fills signup form and submits |
| `getAuthToken(page)` | Reads JWT from localStorage |
| `clearAppState(page)` | Clears localStorage and sessionStorage |

## Test Suites

| Directory | Tests | Notes |
|-----------|-------|-------|
| `tests/auth/` | Signup, login, logout, magic link, forgot password | Creates fresh accounts per test |
| `tests/home/` | Game list, pinning, score reveal | Skips gracefully if no game data |
| `tests/game/` | Detail page, reading position | Navigates via game row click |
| `tests/fairbet/` | Odds display, live tab, parlay builder | Skips if API slow (>20s) |
| `tests/profile/` | Account info, password change, delete account | Skips if auth expired |
| `tests/mobile/` | Bottom tabs, responsive layout | Mobile viewport (390x844) |
| `tests/performance/` | Page load times, navigation speed | Threshold-based assertions |
| `tests/cache/` | LocalStorage staleness, tab visibility | Simulates visibility changes |
| `tests/realtime/` | SSE endpoint connectivity | Verifies proxy responds |
| `tests/settings/` | Theme, score reveal mode, odds format | Toggles settings and verifies |

## Resilience Patterns

Tests are designed to handle environment variability:

- **No game data**: tests using `waitForGameData()` skip with `test.skip(true, "No game data")` instead of failing
- **Slow API**: FairBet tests catch timeouts and skip when the API doesn't respond within 20s
- **Stale auth**: profile tests detect redirect to `/login` and skip
- **Backend down**: signup/login tests skip when the backend doesn't respond within 15s

## Data-testid Attributes

Components expose `data-testid` attributes for stable test selectors:

| Attribute | Component | Element |
|-----------|-----------|---------|
| `game-row` | `GameRow` | Outer div of each game row |
| `pinned-bar` | `PinnedBar` | Pinned games container |
| `pinned-chip` | `PinnedBar` | Individual pinned game chip |
| `bet-card` | `BetCard` | FairBet bet card |
| `league-filter` | Home page | League filter pill container |

## Running in CI

The CI workflow does **not** run Playwright tests (no live backend available in CI). Tests are run locally against the dev server. The CI pipeline validates lint, types, and build only.
