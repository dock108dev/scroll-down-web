# Client-Side Logic Reference

This document lists all logic that intentionally remains in the web app (rather than being delegated to the API). The API is the single source of truth for game status, period labels, score enrichment, FairBet display fields, and EV math. Everything below is UI state, formatting, or client-side filtering that belongs in the browser.

---

## 1. Score Reveal / Hide
User preference stored in localStorage. Toggle read/unread state per game. Controlled by `scoreRevealMode` setting (`"always"` | `"onMarkRead"`). When set to `"onMarkRead"`, scores are hidden until the user explicitly reveals them.

## 2. Read State Management
Local `Set<gameId>` persisted to localStorage via `read-state` Zustand store (`sd-read-state`). Tracks which games the user has "read" (revealed scores for). Supports bulk operations (`markAllRead`, `markAllUnread`) for the "Mark All Read" feature.

## 3. Reading Position Tracking
Per-game scroll position with score snapshot saved to localStorage (`sd-reading-position`). Stores `playIndex`, period, clock, scores, and `playCount`. Used for auto-resume on return to a game detail page and for detecting new data on live games (score freeze with amber dot).

## 4. Section Expansion State
Which home sections (Earlier, Yesterday, Today, Tomorrow) and game detail sections are collapsed/expanded. Defaults: Today and Yesterday expanded. Persisted in `sd-settings` store.

## 5. Client-side Search Filtering
Instant team name / abbreviation filtering on the home page for responsiveness (no round-trip to API).

## 6. Live Polling
- **Game detail:** 45-second polling interval when game is live (`useGame`)
- **Home page:** 60-second auto-refresh interval, pauses when tab is hidden, resumes immediately on focus (`useGames`)

## 7. Client-side Cache
5-minute TTL, 8-entry LRU for game detail responses (`useGame`). Prevents redundant fetches on back-navigation. Cache is in-memory only, cleared on page reload.

## 8. Theme Management
System/light/dark preference managed via Zustand store and CSS custom properties. Light mode inverts the neutral palette via `:root` / `.dark` class toggling. FairBet uses dedicated `--fb-*` CSS variables for theme adaptation.

## 9. Odds Format Preference
American/decimal/fractional display toggle. `formatOdds()` in `utils.ts` handles conversion.

## 10. Date/Time Formatting
`formatDate()` and `formatTime()` — locale-aware display formatting. Stays client-side because it depends on user timezone/locale.

## 11. Bold Keywords in Timeline
`BOLD_KEYWORDS` array in `TimelineRow.tsx` for play description styling (e.g., "GOAL", "TOUCHDOWN", "DUNK", "makes", "MISS"). Combined with a regex that also de-emphasizes parenthetical content.

## 12. Game Sorting Within Sections
Games are fetched by date-range sections (Earlier, Yesterday, Today, Tomorrow). Within each section, games are rendered in the order returned by the API. The home feed fetches in two phases: Yesterday + Today first (fast render), then Earlier + Tomorrow (background).

## 13. FairBet Client-side Filtering
League, market category, book, team/player search, +EV only, hide thin confidence, hide started games. All applied client-side to the full bet list for instant feedback. Minimum 3 books required per bet for display. Deduplication by `game_id::market_key::selection_key::line_value`.

## 14. FairBet Client-side Sorting
By best EV% (descending), game time, or league. Applied client-side to the filtered bet list.

## 15. FairBet Pagination
100 bets per page with up to 3 concurrent page fetches. First page renders immediately, remaining pages load in the background with progress indicator.

## 16. Parlay Selection State
Which bets are selected for parlay building (UI state). Evaluation calls the API (`POST /api/fairbet/parlay/evaluate`) which returns fair probability, fair american odds, and confidence tier. Assumes independent legs.

## 17. EV Color Mapping
`getEVColor()`, `getConfidenceColor()` — pure UI theming based on numeric thresholds. Maps EV percent and confidence tier to CSS colors. Strong positive (>=5%) gets bright green, mild positive gets muted green, negative gets coral.

## 18. FairExplainerSheet Display
Shows API-provided method name (`evMethodDisplayName`), explanation (`evMethodExplanation`), fair odds (`fairAmericanOdds`), confidence label (`confidenceDisplayLabel`), and step-by-step explanation (`explanation_steps`). All display values come from the API.

## 19. Odds Table Best Price
`isBest` flag from the API marks the best price per side. Highlights the best book price in the cross-book comparison table.

## 20. Odds Table Grouping
Mainline odds grouped by market type (Spread, Moneyline, Total, Team Total) with section headers. Non-mainline categories (player props, team props, alternates, period, game props) displayed with category tabs.

## 21. Player Stats Deduplication
`PlayerStatsTable` deduplicates players by name when the API returns multiple stat entries for the same player (e.g., from different sources). Merges `rawStats`, preferring scalar values over objects. Handles object-shaped stats (e.g., `{offensive: 1, defensive: 3}`) by extracting numeric totals.

## 22. Score Freeze for Live Games
When a user reveals a live game's score, the displayed score freezes at the moment of reveal. New data arriving via polling shows a subtle indicator dot. When a live game goes final while frozen, scores auto-hide so the user can reveal the final result on their terms.

## 23. Team Name Display
`cardDisplayName()` in `utils.ts` extracts display-appropriate names: school names for college sports (NCAAB, NCAAF) and nicknames/mascots for pro leagues (NBA, NFL, NHL, MLB). Falls back to abbreviation when names exceed 15 characters.
