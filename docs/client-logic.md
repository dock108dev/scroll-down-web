# Client-Side Logic Reference

Everything below is UI state, formatting, or client-side filtering that intentionally remains in the browser. The API is the single source of truth for game status, period labels, score enrichment, FairBet display fields, and EV math.

---

## 1. Score Reveal / Hide
User preference stored in localStorage. Toggle read/unread state per game. Controlled by `scoreRevealMode` setting (`"always"` | `"onMarkRead"`). When set to `"onMarkRead"`, scores are hidden until the user explicitly reveals them.

## 2. Score Reveal State Management
Managed by the `reveal` Zustand store (persisted under `sd-read-state` key). Tracks `revealedIds` (Set of game IDs, capped at 500) and `snapshots` (Map of frozen score data, capped at 20). Supports batch operations (`revealBatch`, `hideBatch`) for "Mark All Read" / "Mark as Unread".

## 3. Score Freeze for Live Games
When a user reveals a live game's score, the displayed score freezes at the moment of reveal. New data arriving via realtime patches shows a subtle indicator dot. When a live game goes final while frozen, scores auto-hide so the user can reveal the final result on their terms.

## 4. Reading Position Tracking
Per-game scroll position with score snapshot saved to localStorage (`sd-reading-position`). Stores `playIndex`, period, clock, and `playCount`. Used for auto-resume on return to a game detail page. Auto-prunes entries older than 30 days (max 50 entries).

## 5. Section Expansion State
Which home sections (Yesterday, Today) and game detail sections are collapsed/expanded. Persisted in `sd-settings` and `sd-section-layout` stores. Section layouts capped at 50 entries.

## 6. Client-side Search Filtering
Instant team name / abbreviation filtering on the home page and history page for responsiveness (no round-trip to API). History page search uses 300ms debounce.

## 7. Realtime Subscription Management
Hooks declare which channels to subscribe to via `useRealtimeSubscription()`. The transport layer manages WebSocket/SSE connections. Components do not handle raw events — the centralized dispatcher routes events into the Zustand store, and components re-render from store state.

## 8. Visibility-Driven Refresh
When the browser tab regains focus and the realtime connection is offline, hooks trigger a silent REST refresh. This replaces the previous periodic polling approach. Live games also freeze/accept score snapshots on visibility changes.

## 9. Client-side Cache
Freshness-based caching in the `game-data` Zustand store (in-memory, not persisted):
- Game detail: 5-minute freshness TTL, max 8 entries
- Game flow: 5-minute freshness TTL, max 8 entries
- Game lists: 90-second TTL, 45-second freshness window, max 5 entries per league
- FairBet odds: 3-minute TTL, 90-second freshness window (in-memory module cache)

## 10. Theme Management
System/light/dark preference managed via Zustand store and CSS custom properties. Light mode inverts the neutral palette via `:root` / `.dark` class toggling. FairBet uses dedicated `--fb-*` CSS variables for theme adaptation.

## 11. Odds Format Preference
American/decimal/fractional display toggle. `formatOdds()` in `utils.ts` handles conversion.

## 12. Date/Time Formatting
`formatDate()` — locale-aware display formatting. Stays client-side because it depends on user timezone/locale.

## 13. Eastern Timezone Date Bucketing
`toEasternDateStr()` in `useGamesList.ts` converts game dates to US/Eastern time before bucketing into Yesterday/Today sections. This prevents late-night ET games (whose UTC date is the next day) from appearing in the wrong section.

## 14. Bold Keywords in Timeline
`BOLD_KEYWORDS` array in `TimelineRow.tsx` for play description styling (e.g., "GOAL", "TOUCHDOWN", "DUNK", "makes", "MISS"). Combined with a regex that also de-emphasizes parenthetical content.

## 15. Game Sorting Within Sections
Home page: games sorted by status (live first, then scheduled, then final) then by time; final games on prior days sort alphabetically by away team. History page: sortable by away team, home team, or time.

## 16. FairBet Client-side Filtering
League, market category, book, team/player search, +EV only, hide thin confidence, hide started games. All applied client-side to the full bet list for instant feedback. Minimum 3 books required per bet for display. Deduplication by `game_id::market_key::selection_key::line_value`.

## 17. FairBet Client-side Sorting
By best EV% (descending), game time, or league. Applied client-side to the filtered bet list.

## 18. FairBet Pagination
100 bets per page with up to 3 concurrent page fetches. First page renders immediately, remaining pages load in the background with progress indicator.

## 19. Parlay Fair Odds (Client-side)
Which bets are selected for parlay building (UI state). Fair probability computed client-side via `parlayProbIndependent()` in `fairbet-utils.ts`, which multiplies individual leg true probabilities. Assumes independent legs — no correlation modeling.

## 20. EV Color Mapping
`getEVColor()`, `getConfidenceColor()` — pure UI theming based on numeric thresholds. Maps EV percent and confidence tier to CSS colors. Strong positive (>=5%) gets bright green, mild positive gets muted green, negative gets coral.

## 21. Bet Enrichment
`enrichBet()` in `fairbet-utils.ts` adds camelCase aliases to snake_case API fields for consistent use in components.

## 22. Odds Table Best Price
`isBest` flag from the API marks the best price per side. Highlights the best book price in the cross-book comparison table.

## 23. Odds Table Grouping
Mainline odds grouped by market type (Spread, Moneyline, Total, Team Total) with section headers. Non-mainline categories (player props, team props, alternates, period, game props) displayed with category tabs.

## 24. Player Stats Deduplication
`PlayerStatsTable` deduplicates players by name when the API returns multiple stat entries for the same player. Merges `rawStats`, preferring scalar values over objects.

## 25. Team Name Display
`cardDisplayName()` in `utils.ts` extracts display-appropriate names: school names for college sports (NCAAB, NCAAF) and nicknames/mascots for pro leagues (NBA, NFL, NHL, MLB). Falls back to abbreviation when names exceed 15 characters.

## 26. Pinned Games
Users can pin up to 10 games from the home feed. Pinned game IDs are persisted in the `pinned-games` Zustand store (`sd-pinned-games`). The `PinnedBar` renders pinned games as scrollable chips in the header, showing team abbreviations, status dots, and mini scores.

## 27. UTF-8 Mojibake Repair
`fixMojibake()` in `api-server.ts` detects and repairs common UTF-8 double-encoding artifacts in text from the API. Applied server-side to all API responses before they reach the browser.

## 28. Timeline Deduplication
Timeline entries are deduplicated client-side to handle cases where the API returns overlapping play-by-play data from multiple sources. PBP entries are deduped by `eventId` (preferred) or composite key (`playIndex|gameClock|playType|description`).

## 29. Home Scroll Restoration
Scroll position on the home page is tracked via the `home-scroll` store (in-memory). On back-navigation, the scroll position is restored.

## 30. History URL State
History page stores all filters (league, search, sort mode, date range) in URL search parameters. This enables shareable links and browser back/forward navigation.

## 31. Progressive Card Rendering
FairBet bet cards render in batches of 25 using IntersectionObserver, loading more as the user scrolls. History page uses the same infinite-scroll pattern with 25 games per page.
