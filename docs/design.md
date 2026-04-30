# Design Principles & Patterns

## Design Principles

### 1. Trust First

The app wins or loses on whether the user feels safe trusting the data. This means:

- Scores must be right
- Betting lines / outcomes must be right
- Reveal state must never feel flaky
- Live update behavior must make sense
- Nothing AI-generated can feel more authoritative than actual game data
- The public app must not expose half-baked surfaces that weaken trust

**Never let the user wonder what kind of truth they are looking at.** Data refresh timing, reveal state, live/paused status, official data vs. generated summary, betting data vs. estimation, stale vs. current — all must be visibly communicated.

### 2. Reveal Mode Is the Product's Point of View

Most sports apps assume you want every result immediately. We don't.

Reveal mode is not a hidden setting or power-user toggle — it is the app's identity. The product stance:

> Follow games without having scores shoved in your face.

This means reveal/unread behavior is primary in every design decision: home page, game detail, notifications, sharing.

### 3. Minimal Public Surface

For v1, the public app is Games + FairBet. Everything else is secondary, admin-only, or conditional.

- Don't make users wonder: "is this a score app, a betting tool, a golf leaderboard, or an AI recap site?"
- The answer must be obvious in 5 seconds
- Breadth hurts more than it helps until the core is sticky
- Surfaces that aren't excellent yet should be hidden, not shipped

### 4. Motion Signals Life

Live games use subtle animation (score flash, pulsing indicators) to communicate freshness. Final games are still. Stale data is muted. The visual language:

- **Pulsing/animated** → live, updating
- **Static, full color** → final, confirmed
- **Muted/gray** → stale or historical

### 5. Ship the Boring Version

Launch the version where people say "this is clean, useful, and trustworthy" — not "wow there's a lot here." Complexity earns its way in by proving value, not by existing.

## Patterns

### Zustand Store Shape

All stores follow the same pattern: state + actions in a single `create()` call, with `persist` middleware for stores that survive page reload.

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  theme: "system" | "light" | "dark";
  scoreRevealMode: "onMarkRead" | "always";
  setTheme: (theme: SettingsState["theme"]) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      scoreRevealMode: "onMarkRead",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "sd-settings" }
  )
);
```

### Data Fetching via `fetchApi`

All client-side API calls go through `src/lib/api.ts`:

```typescript
import { fetchApi } from "@/lib/api";

const games = await fetchApi<GameSummary[]>("/api/games?date=2026-04-17");
```

This wrapper:
- Injects `Authorization: Bearer {token}` when logged in
- Applies a 3-second timeout by default
- Triggers auto-logout on 401
- Classifies errors for consistent handling

**Never use raw `fetch()` in client code.** Server-side routes use `src/lib/api-server.ts` instead.

### Realtime Subscriptions

Components subscribe to channels via hook, with automatic cleanup on unmount:

```typescript
import { useRealtimeSubscription } from "@/realtime/useRealtimeSubscription";

// Subscribe to live game updates
useRealtimeSubscription(`game:${gameId}:summary`);
```

The dispatcher routes all incoming events into the `game-data` Zustand store. Components don't handle raw WebSocket messages — they read from the store via selectors.

### Trust Signal UI

Every piece of data should communicate its provenance and freshness:

- **Freshness labels**: routine live refreshes stay silent; warn only when data is meaningfully stale
- **Staleness thresholds**: fresh (no label) → amber warning → red "data delayed"
- **Source attribution**: bookmaker logos inline for odds, "via [source]" for stats
- **Score update flash**: brief highlight animation when score changes (600ms yellow flash or scale pulse)
- **Live indicator**: pulsing dot + "LIVE" for in-progress games
- **Generated content**: AI text labeled softly but clearly — never visually equal to factual data

### Score Reveal Interaction

The reveal gesture must feel deliberate and satisfying:

1. Game row shows teams, time, status — score area is blurred/hidden
2. User taps Reveal → score appears with brief animation
3. Score snapshot captured (score + period + clock at that moment)
4. If live score later changes from snapshot → UPDATE indicator
5. Revealed state persists across page reloads (IndexedDB)
6. Following Live mode overrides: all scores visible, continuous updates

### FairBet Card Structure

Each bet card communicates value clearly for non-experts:

```
┌─────────────────────────────────────┐
│ NBA · Lakers vs Celtics             │
│ Spread: Lakers -3.5                 │
│                                     │
│ Best Price: -108 (DraftKings)       │
│ Fair Price: -110                    │
│ EV: +$2.40 per $100 ▲              │
│                                     │
│ [Book1] [Book2] [Book3]            │
└─────────────────────────────────────┘
```

Key patterns:
- **Dollar-value EV framing**: "+$2.40 per $100 bet" not "+2.4% EV" — accessible to non-bettors
- **Traffic-light tiers**: green (strong value) → yellow (marginal) → gray (no edge)
- **Book comparison chips**: visual, tappable, with logos
- **Fair price explanation**: tooltip or sheet explaining "what this bet should cost"

## Anti-Patterns

### Don't: Call `fetch()` directly in client code
Use `fetchApi()` from `src/lib/api.ts`. Direct fetch skips auth injection, timeouts, and error classification.

### Don't: Animate final/confirmed data
Animation signals "this is changing." Final scores, completed game status, and historical data should be static. Only live, updating data gets motion.

### Don't: Expose experimental surfaces publicly
If it's not excellent, it should be admin-gated or hidden. A half-baked analytics tab or thin AI summary damages trust more than its absence would.

### Don't: Mix AI text with factual data at the same visual weight
AI-generated content (game stories, wrap-ups) must never look more authoritative than scores, odds, or play-by-play. Use lighter typography, "beta" labels, or secondary positioning.

### Don't: Mutate Zustand state directly
Always use the store's action methods. Never reach into state and modify objects in place.

### Don't: Scatter constants across files
Cache TTLs, polling intervals, storage limits, realtime thresholds — all belong in `src/lib/config.ts`.

### Don't: Add new public nav items without discussion
The public surface is deliberately minimal (Games + FairBet). Adding a new tab dilutes the product identity.

### Don't: Insert ads in score/reveal moments
Ads (when added) must never interrupt the reveal gesture, appear between game rows during live action, or cause layout shift near scores.

## Naming Conventions

| Category | Convention | Examples |
|----------|-----------|---------|
| Files/directories | kebab-case | `game-data.ts`, `fairbet-utils.ts` |
| React components | PascalCase | `GameHeader`, `BetCard` |
| Component files | PascalCase `.tsx` | `GameHeader.tsx`, `BetCard.tsx` |
| Hooks | `use` prefix, camelCase | `useGameDetail`, `useFairBetOdds` |
| Constants | `SCREAMING_SNAKE_CASE` | `CACHE_TTL_GAMES`, `MAX_PINNED` |
| `data-testid` | kebab-case | `game-row`, `bet-card`, `pinned-bar` |
| Realtime channels | colon-delimited | `games:nba:2026-04-17`, `game:123:pbp` |
| localStorage keys | `sd-` prefix, kebab-case | `sd-auth`, `sd-settings`, `sd-read-state` |

## Error Handling

### Three Error Surfaces

1. **Fetch errors**: Handled by data hooks. Show cached data on failure, skip with stale indicator. Auto-retry with backoff (3s, 6s, 12s).
2. **Realtime errors**: Transport handles failover automatically (WS → SSE → polling). Components are unaware of transport layer.
3. **Auth errors**: 401 → auto-logout. Rate limit → retry after header. Backend 5xx → generic error (no detail leakage).

### What Makes a Good Error Message

- Tell the user what happened, not what went wrong internally
- Offer a retry action when the error is transient
- Skip gracefully when data is non-critical (e.g., golf section, AI story)
- Never show stack traces, API paths, or internal error codes

### What Not to Catch

- Don't wrap every function in try/catch — let React error boundaries handle unexpected crashes
- Don't retry auth failures (401) — logout and redirect
- Don't suppress errors silently unless you're intentionally falling back to cache

## Testing Strategy

### Two Layers

- **Vitest unit tests** for pure logic and isolated component contracts (currently `lib/ads/entitlements.ts` and `<AdSlot>`). Live under `web/tests/unit/`.
- **Playwright E2E** for product flows. Runs against a live dev server on `localhost:3001`. Two browser projects: desktop Chromium and mobile-viewport Chromium.

Most coverage is still E2E. Reach for a unit test when the logic is pure, the component has a clear contract, or the failure mode is hard to reproduce in a browser run.

### Test Priorities

| Priority | What | Example |
|----------|------|---------|
| P0 (smoke) | Core flows work | Home loads, game detail opens, reveal works |
| P1 | Feature correctness | Pinning, FairBet filtering, settings persistence |
| P2 | Edge cases | Stale cache, realtime fallback, auth expiry |
| P3 | Polish | Mobile responsive, performance thresholds, analytics events |

### Resilience

Tests handle environment variability:
- **No game data**: Skip gracefully, don't fail
- **Slow API**: Skip FairBet tests if API doesn't respond in 20s
- **Stale auth**: Detect redirect to `/login`, skip
- **Backend down**: Signup/login tests skip when backend unresponsive

### Test ID Convention

Every interactive or assertable element needs a `data-testid`. Full list in `docs/testing.md`.

### CI

- **Every push**: Smoke tests (`@smoke` tag) via `playwright-smoke` job
- **Daily**: Full suite at 6 AM UTC via `e2e-daily.yml`
- Both produce `playwright-report` artifacts
