# Client-Side Logic Reference

This document lists all logic that intentionally remains in the web app (rather than being delegated to the API). The API is the single source of truth for game status, period labels, score enrichment, FairBet display fields, and EV math. Everything below is UI state, formatting, or client-side filtering that belongs in the browser.

---

## 1. Score Reveal / Hide
User preference stored in localStorage. Toggle read/unread state per game. Controlled by `scoreRevealMode` setting ("always" | "onMarkRead").

## 2. Read State Management
Local `Set<gameId>` persisted to localStorage via `read-state` Zustand store. Tracks which games the user has "read" (revealed scores for).

## 3. Reading Position Tracking
Per-game scroll position with score snapshot saved to localStorage. Used for auto-resume on return to a game detail page.

## 4. Section Expansion State
Which home/game sections are collapsed/expanded (Flow, Timeline, Stats, Odds, Wrap-Up). Defaults are computed locally based on game status and data availability.

## 5. Client-side Search Filtering
Instant team name / abbreviation filtering on the home page for responsiveness (no round-trip to API).

## 6. Live Polling
- Game detail: 45-second polling interval when game is live
- Home page: 15-minute auto-refresh interval

## 7. Client-side Cache
5-minute TTL, 8-entry LRU for game detail responses. Prevents redundant fetches on navigation.

## 8. Theme Management
System/light/dark preference managed via Zustand store and CSS variables.

## 9. Odds Format Preference
American/decimal/fractional display toggle. `formatOdds()` in `utils.ts` handles conversion.

## 10. Date/Time Formatting
`formatDate()`, `formatTime()`, `formatGameDateTime()` — locale-aware display formatting. Stays client-side because it depends on user timezone/locale.

## 11. Bold Keywords in Timeline
`BOLD_KEYWORDS` regex in `TimelineRow.tsx` for play description styling (e.g., "GOAL", "TOUCHDOWN", "DUNK").

## 12. Game Sorting Within Sections
Games are fetched by date-range sections (Earlier, Yesterday, Today, Tomorrow). Within each section, games are rendered in the order returned by the API.

## 13. FairBet Client-side Filtering
League, market category, book, +EV only, hide thin, hide started. All applied client-side for instant feedback.

## 14. FairBet Client-side Sorting
By EV (best first), game time, or league. Applied client-side to the filtered bet list.

## 15. FairBet Pagination
500 bets per page with 3-concurrent page loading. Incremental append to render as data arrives.

## 16. Parlay Selection State
Which bets are selected for parlay building (UI state). Evaluation now calls the API (`POST /api/fairbet/parlay/evaluate`) with client-side fallback.

## 17. EV Color Mapping
`getEVColor()`, `getConfidenceColor()` — pure UI theming based on numeric thresholds. Maps EV percent and confidence tier to CSS colors.

## 18. FairExplainerSheet Display
Shows API-provided method name (`evMethodDisplayName`), explanation (`evMethodExplanation`), fair odds (`fairAmericanOdds`), and confidence label (`confidenceDisplayLabel`). Step-by-step math section removed — pending API `explanation_steps` field for re-implementation.

## 19. Odds Table Best Price
`findBestPrice()` uses API `isBest` flag when available, falls back to local max-price computation.

## 20. Odds Table Grouping
`groupIntoPairs()` for side-by-side spread display and `rowKey()` for row identity. Stays client-side until API provides pre-structured odds table.
