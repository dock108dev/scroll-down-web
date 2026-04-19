# Minimal fixtures / invariants for SDA

Use this when **reproducing Playwright failures** or when **web stubs** `/api/games`, `/api/fairbet/*`, or `/api/history` in local CI. Shapes align with [`web/src/lib/types.ts`](../src/lib/types.ts) (`GameListResponse`, `GameDetailResponse`, etc.). The web BFF forwards to upstream paths such as **`/api/admin/sports/games`** (see [`web/src/app/api/games/route.ts`](../src/app/api/games/route.ts)).

## 1. Games list (`GET /api/games`)

**Invariant:** `200` JSON with `games: GameSummary[]` where at least one row is renderable on `/` (`[data-testid='game-row']`).

**Minimal `GameSummary` fields** tests rely on most often:

- `id` (number), `leagueCode`, `gameDate`, `status`, `homeTeam`, `awayTeam`
- Optional: `homeScore`, `awayScore`, `hasFlow`, `hasOdds`, `isLive`, and any **ingestion timestamps** your BFF exposes that drive freshness UI — see game row / realtime store code for exact fields.

**Empty slate:** many tests call `test.skip("No game data available from API")`. SDA regression packs should include **at least one game per league** the UI shows pills for (e.g. mlb, nba, ncaab, nhl) for a **stable date window**.

## 2. FairBet (`/fairbet` → `/api/fairbet`, `/api/fairbet/odds`, …)

**Invariant:** Within timeout, either:

- At least one `[data-testid='bet-card']`, **or**
- `[data-testid='fairbet-empty-state']` with intentional copy (empty is a valid product state).

**Card-level UI** (smoke) expects, when cards exist:

- EV / tier / book row / attribution / line-movement regions per test name in [`fairbet.spec.ts`](./fairbet.spec.ts) and [`fairbet/phase9.spec.ts`](./fairbet/phase9.spec.ts).

SDA should own **numeric consistency** (EV, implied prob, cross-book agreement). Web tests only assert **presence and coarse behavior** (blur for free, simulators for pro, etc.).

## 3. History (`GET /api/history?…`)

**Invariant:** For pro-tier cookie or `?tier=pro`, response must allow [`/history`](../src/app/history/page.tsx) to render `[data-testid='page-history']` when authorized; free tier returns **403** `pro_required` for gated API tests (see [`fairbet/phase9.spec.ts`](./fairbet/phase9.spec.ts)).

Date ranges in tests may be **fixed** (e.g. single day) — SDA fixtures should return **stable** payloads for those query params or document supported windows.

## Web stubbing (for future CI hardening)

[`errors/api-errors.spec.ts`](./errors/api-errors.spec.ts) already shows **`page.route("**/api/games**", …)`** patterns. A shared **fixture JSON** file (checked into `web/tests/fixtures/`) plus route interception would remove `@live-upstream` from specific tests without changing SDA contracts.

## 4. Phase 9 book-details blur (daily E2E)

[`fairbet/phase9.spec.ts`](./fairbet/phase9.spec.ts) **FairBet book-details blur (ISSUE-061)** installs a `page.route("**/api/fairbet/odds**", …)` `beforeEach` that returns a minimal [`BetsResponse`](../src/lib/types.ts)-shaped JSON (`bets[]` with multi-book `books`, `has_fair`, `fair_american_odds`, `best_ev_percent`). That keeps blur / pro / layout-shift tests stable in `npx playwright test` when the real odds feed is empty. **SDA** should still satisfy section 2 for production; the stub documents the minimum card shape those assertions need.
