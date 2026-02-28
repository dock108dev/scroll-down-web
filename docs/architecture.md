# Architecture

System architecture and data flow for the Scroll Down Sports web app.

---

## Design Principle

The web app is a **thin display layer**. The backend computes all derived data — period labels, play tiers, odds outcomes, team colors, EV calculations, merged timelines. The client reads pre-computed values and renders them. No game logic, stat derivation, or EV math runs client-side.

## Data Flow

```
Browser (React)
    ↓ fetch("/api/games")
Next.js API Route (server-side)
    ↓ apiFetch() with X-API-Key header
Backend API (sports-data-admin.dock108.ai)
    ↓ JSON response
Next.js API Route
    ↓ NextResponse.json()
Browser → React hook (useGames / useGame / useFairBetOdds) → Component re-render
```

All backend calls go through Next.js API routes (`/api/*`), which add the `X-API-Key` header server-side. The API key is never exposed to the browser.

### API Proxy Routes

| Client Route | Backend Endpoint | Revalidation | Purpose |
|---|---|---|---|
| `GET /api/games` | `/api/admin/sports/games` | 60s | Game list by date range |
| `GET /api/games/{id}` | `/api/admin/sports/games/{id}` | 30s | Game detail (stats, odds, plays, social) |
| `GET /api/games/{id}/flow` | `/api/games/{id}/flow` | 60s | Game flow narrative (blocks + moments) |
| `GET /api/fairbet/odds` | `/api/fairbet/odds` | 60s | FairBet odds with EV |

Revalidation uses Next.js ISR (`next: { revalidate }` on server-side fetch).

## Component Architecture

Pages are thin orchestrators. Hooks fetch data, stores provide persisted state, components render.

```
page.tsx (route)
    ├─ useGames() / useGame() / useFairBetOdds()    # Data fetching
    ├─ useSettings() / useReadState()                # Zustand state
    └─ <GameSection> / <GameHeader> / <BetCard>      # Components
```

Components are organized by feature:

```
components/
├── home/       # Home page: GameSection, GameCard, SearchBar, PinnedBar
├── game/       # Game detail: GameHeader, FlowContainer, TimelineSection,
│               # PlayerStatsSection, TeamStatsSection, OddsSection, WrapUpSection, etc.
├── fairbet/    # FairBet: BetCard, BookFilters, FairExplainerSheet, ParlaySheet
├── settings/   # SettingsContent
├── layout/     # TopNav, BottomTabs, ThemeProvider, SettingsDrawer
└── shared/     # LoadingSkeleton, CollapsibleCard, SectionHeader, TeamColorDot
```

## Data Fetching Hooks

### useGames

Fetches the home feed, organized by date sections (Earlier, Yesterday, Today, Tomorrow).

- **Two-phase loading:** Yesterday + Today first (fast render), Earlier + Tomorrow in background
- **Auto-refresh:** 60-second interval, pauses when tab is hidden, resumes on focus
- **Client-side search:** Filters by team name/abbreviation without API round-trip
- **Timezone:** Uses US/Eastern for section boundaries

### useGame

Fetches a single game detail with caching and live polling.

- **In-memory LRU cache:** 5-minute TTL, max 8 entries
- **Live polling:** 45-second interval when game status is live, stops on final
- **Silent updates:** Polling doesn't reset loading state

### useFlow

Fetches game flow data (narrative blocks and moments). Simple fetch-on-mount, no caching or polling.

### useFairBetOdds

Complex hook for FairBet odds with pagination, filtering, sorting, and parlay management.

- **Pagination:** 100 bets/page, first page renders immediately, remaining pages load with up to 3 concurrent fetches
- **Filtering:** League, market category, book, search, +EV only, hide thin confidence, hide started. Minimum 3 books per bet. Client-side deduplication
- **Sorting:** By best EV% (descending), game time, or league
- **Parlay:** Toggle bets, client-side `parlayProbIndependent()` computes combined fair odds
- **Enrichment:** `enrichBet()` adds camelCase aliases and display labels to snake_case API responses

## State Management

Six Zustand stores persist to localStorage:

| Store | Key | Purpose |
|---|---|---|
| `settings` | `sd-settings` | Theme, odds format, score reveal mode, preferred book, section expansion |
| `read-state` | `sd-read-state` | Which games the user has marked as read (score revealed) |
| `reading-position` | `sd-reading-position` | Per-game scroll position and score snapshot |
| `section-layout` | `sd-section-layout` | Game detail section collapse/expand state |
| `pinned-games` | `sd-pinned-games` | User-pinned games for quick access |
| `ui` | `sd-ui` | Transient UI state (drawers, sheets, modals) |

### Settings Store Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `theme` | `"system" \| "light" \| "dark"` | `"system"` | Color theme preference |
| `scoreRevealMode` | `"always" \| "onMarkRead"` | `"onMarkRead"` | Score visibility behavior |
| `oddsFormat` | `"american" \| "decimal" \| "fractional"` | `"american"` | Odds display format |
| `preferredSportsbook` | `string` | `""` | Preferred book highlight |
| `autoResumePosition` | `boolean` | `true` | Resume scroll on game return |
| `homeExpandedSections` | `string[]` | `["Today", "Yesterday"]` | Expanded home sections |
| `hideLimitedData` | `boolean` | `true` | Hide thin-market odds |

## Game Status Lifecycle

```
scheduled → pregame → in_progress / live → completed / final → archived
```

Helper functions: `isLive()`, `isFinal()`, `isPregame()` (in `lib/types.ts`).

Content changes based on status:
- **Pregame:** Overview + Odds sections
- **Live:** Timeline + Stats + Odds, with 45-second polling
- **Final:** Flow + Timeline + Stats + Odds + Wrap-Up

## Flow Rendering

Game flow is a server-generated narrative structure. Each `FlowBlock` contains:

| Field | Description |
|---|---|
| `blockIndex` | Position in the flow (0 to N-1) |
| `role` | Semantic role (setup, momentum_shift, response, decision_point, resolution) — not displayed in UI |
| `narrative` | 1-2 sentence description (~35 words) |
| `miniBox` | Player stats for this segment with `blockStars` array |
| `periodStart` / `periodEnd` | Period range covered |
| `scoreBefore` / `scoreAfter` | Score progression as `[away, home]` |
| `keyPlayIds` | Plays explicitly mentioned in narrative |
| `embeddedSocialPostId` | Optional linked social post |

`FlowContainer` resolves blocks from either `data.flow.blocks` (nested) or `data.blocks` (top-level) to handle both API response shapes.

## Score Reveal

Two modes controlled by `scoreRevealMode`:

| Mode | Behavior |
|---|---|
| `onMarkRead` | Scores hidden until user taps to reveal (default, spoiler-free) |
| `always` | Scores always visible on cards and headers |

Additional behaviors:
- **Score freeze:** Revealed live game scores freeze at the moment of reveal. An amber dot appears when new data arrives via polling.
- **Auto-hide on final:** When a live game transitions to final while scores are frozen, the game auto-hides to prevent spoiling the final score.
- **Mark All Read:** Bulk action to reveal all eligible games.

## Team Color System

Team colors come from two sources:
1. **Bulk fetch** — `GET /api/teams` returns all teams with `colorLightHex` / `colorDarkHex`, cached via ISR (1 hour)
2. **Per-game injection** — Game detail and flow responses include `homeTeamColorLight`, `homeTeamColorDark`, `awayTeamColorLight`, `awayTeamColorDark`

Team colors are applied via CSS custom properties (`--ds-team-a`, `--ds-team-b`) set from the API-provided hex values.

## FairBet Architecture

**Server-side EV (all computation on backend):**
- Server computes true probability via Pinnacle devig
- Per-bet: `evConfidenceTier` (full/decent/low), `fairAmericanOdds`, `bestEvPercent`, `bestBook`
- Per-book: `evPercent`, `isSharp`, `impliedProb`
- Method transparency: `evMethodDisplayName`, `evMethodExplanation`, `explanationSteps`

**Client-side responsibilities:**
- Display formatting: EV color mapping, confidence labels, odds format conversion
- Filtering and sorting (see items 13-14 in [client-logic.md](client-logic.md))
- Parlay selection state and client-side evaluation via `parlayProbIndependent()`
- Bet enrichment: adding camelCase aliases to snake_case API fields (`enrichBet()`)

## NHL-Specific Stats

NHL games use separate stat models:

| Model | Fields |
|---|---|
| `NHLSkaterStat` | TOI, goals, assists, points, SOG, +/-, PIM, hits, blocked shots |
| `NHLGoalieStat` | TOI, shots against, saves, goals against, save percentage |

Rendered in dedicated `NHLSkatersTable` and `NHLGoaliesTable` components rather than the generic `PlayerStatsTable`.

## Theming

CSS-variable-based light/dark mode:
- `:root` holds light mode palette (inverted neutrals: `--color-neutral-950: #ffffff`, etc.)
- `.dark` class holds dark mode palette (standard neutrals)
- `ThemeProvider` toggles the `dark` class on `<html>` based on settings store
- FairBet uses dedicated CSS variables (`--fb-card-bg`, `--fb-surface-tint`, `--fb-border-subtle`, etc.)
- Tailwind CSS 4 uses `@theme` (not `@theme inline`) so utility classes reference CSS variables

## Deployment

Docker-based, deployed to Hetzner VPS:

```
GitHub Push (main) → CI (lint + typecheck + build) → Docker Build → GHCR Push → SSH Deploy to Hetzner
```

The container runs on port 3000, bound to `127.0.0.1`, reverse-proxied to `scrolldownsports.dock108.dev`.

See [ci-cd.md](ci-cd.md) for the full pipeline.

## Supported Leagues

NBA, NCAAB, NFL, NCAAF, MLB, NHL.

## Known Limitations

- **No authentication** — The web app has no user accounts. All state is local to the browser via localStorage.
- **No service worker** — Cache is in-memory only, cleared on page reload.
- **No offline support** — Requires network connectivity.
- **Parlay assumes independent legs** — Client-side `parlayProbIndependent()` multiplies leg probabilities; no correlation modeling.
- **FairBet client-side fallback removed** — All EV computation is server-side. If the server doesn't provide EV data for a bet, it's displayed without EV.
