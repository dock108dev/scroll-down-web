# Roadmap

> **North star**: Trust first. Minimal public surface. Everything else later.

## Phase 0 — Surface Reduction

**Goal**: Strip the public app down to its core identity. Users should know what this app does within 5 seconds.

**Exit criteria**: Public nav shows only Games + FairBet. All secondary surfaces are admin-gated or hidden.

- [ ] Hide Analytics from public nav (admin-only via role check)
- [ ] Hide History from public nav (admin-only via role check)
- [ ] Remove or gate social reaction embeds on game detail pages
- [ ] Demote AI game flow/wrap-up sections — either hide behind "Game Story (beta)" toggle or remove from initial render
- [ ] Remove golf from public nav (keep routes for direct URL access, remove nav link)
- [ ] Audit all empty states — remove or replace with intentional messaging
- [ ] Reduce home page visual noise: fewer pills, toggles, competing visual elements
- [ ] Lock public nav to: Games (primary), FairBet (secondary)

## Phase 1 — Reveal Mode as Product Identity

**Goal**: Make reveal mode feel like the app's point of view, not a hidden feature. Users should immediately understand "this app lets me control when I see scores."

**Exit criteria**: New user lands on home page and understands reveal mode without reading docs. Reveal state is rock-solid across sessions.

- [ ] Redesign home page hero/headline to lead with reveal concept ("Follow games without having scores shoved in your face")
- [ ] Add first-visit onboarding: 2-3 step explanation of reveal mode (dismissible, not modal)
- [ ] Improve reveal gesture: blur/swipe-to-reveal animation that feels deliberate and satisfying
- [ ] Add per-game read/unread visual indicator (stronger than current treatment)
- [ ] Ensure reveal state survives: page reload, tab close/reopen, browser restart
- [ ] Add batch reveal: "Reveal All" for a date section, "Mark All Read" for caught-up users
- [ ] Verify Following Live ↔ reveal mode interaction is clean (override behavior obvious)
- [ ] Test: Playwright suite for reveal persistence across page reloads, tab visibility changes, and login/logout

## Phase 2 — Data Trust & Live Update Quality

**Goal**: Make every piece of data feel trustworthy. Users should never wonder "is this current?"

**Exit criteria**: Live games show freshness indicators. Stale data is labeled. Score updates animate meaningfully.

- [ ] Add relative freshness labels: "Updated 12s ago" on game cards during live games
- [ ] Implement staleness thresholds: fresh (no label) → seconds ago → amber "may be delayed" → red warning
- [ ] Add score update animation: brief highlight flash (yellow/gold, 600ms) when score changes via realtime
- [ ] Add pulsing live indicator (dot + "LIVE" badge) for in-progress games
- [ ] Ensure final games are visually static — no animation, no pulsing, muted styling
- [ ] Add source attribution where applicable: bookmaker logos on odds, data source footer
- [ ] Add DegradedBanner improvements: clearer messaging, auto-dismiss on recovery
- [ ] Implement progress ring or refresh countdown for polling intervals (optional, evaluate UX)
- [ ] Test: E2E for stale data display, realtime fallback (WS → SSE), visibility refresh on tab return

## Phase 3 — Game Detail Page Quality

**Goal**: Make the game detail page a "safe catch-up" experience with clear information hierarchy.

**Exit criteria**: Game page has one obvious primary section. Generated content is visually demoted. Stats are useful, not overwhelming.

- [ ] Establish section priority order: (1) Score/status header, (2) Timeline/story, (3) Key stats, (4) Odds/outcomes, (5) Everything else
- [ ] Simplify timeline: default to high-impact plays only (tier 1-2), expandable to full PBP
- [ ] Simplify player stats: show headline stats per player, expand for full line. Sport-specific via `team-stats-config.ts`
- [ ] Add team stats comparison: side-by-side with clear visual (bar charts or simple table)
- [ ] Improve odds section: show outcome (covered/pushed/lost) for settled games, book logos inline
- [ ] If AI game story stays: add "Game Story (beta)" label, lighter typography, position below factual sections
- [ ] If AI game story quality is insufficient: hide entirely, replace with expanded timeline
- [ ] Ensure reading position resume works reliably (scroll to last play after 300ms render delay)
- [ ] Test: E2E for section navigation, reading position resume, stats display per sport

## Phase 4 — FairBet V1

**Goal**: Make FairBet a clear, trustworthy value tool that non-experts can understand. This is the monetization wedge.

**Exit criteria**: A non-bettor can look at a FairBet card and understand "this bet is good/bad value and here's why."

- [ ] Implement dollar-value EV framing: "+$2.40 per $100 bet" instead of abstract percentages
- [ ] Add traffic-light EV tiers: dark green (>+7%), light green (+3-7%), yellow (+1-3%), gray (no edge)
- [ ] Simplify market display: default to mainlines (spread, total, moneyline) only, hide alt/prop markets behind "More Markets"
- [ ] Add fair price explanation: tap tooltip or expandable sheet explaining "what this bet should cost vs what you're getting"
- [ ] Improve book comparison: show top 3-4 books with best price highlighted, logos inline
- [ ] Add odds source attribution: which books, when last updated, freshness indicator
- [ ] Implement fair price calculation: multiplicative no-vig devig as baseline method
- [ ] If Pinnacle access available: use Pinnacle closing lines as benchmark (sharp-line method)
- [ ] Design FairBet empty state: clear messaging when no value bets found ("Markets are tight today")
- [ ] Test: E2E for FairBet card display, filter interactions, live odds polling

## Phase 5 — AI Game Story (Quality-Gated)

**Goal**: Add game narrative that is short, factual, and tied to real plays — or don't ship it at all.

**Exit criteria**: Game stories pass a quality gate: no generic filler, all facts verifiable against box score, adds value beyond the timeline.

**This phase is conditional.** If story quality does not meet the bar, skip to Phase 6.

- [ ] Build content selection pipeline: extract 8-15 salient events from box score (lead changes, big performances, largest runs)
- [ ] Classify narrative type: comeback, dominant performance, blowout, back-and-forth, defensive battle
- [ ] Create slot-filled prompt templates: structured facts in template, not raw box scores to LLM
- [ ] Implement anti-filler rules: ban generic phrases ("both teams fought hard", "thrilling contest"). Test: "Would this sentence be false if the score reversed?"
- [ ] Add sentence budgets: allocate X sentences per section (prevents padding)
- [ ] Build fact verification: extract all numbers from output, verify against source box score data
- [ ] Design story UI: lighter typography than factual data, "beta" label, positioned below timeline/stats
- [ ] Add inline feedback: "Was this useful?" thumbs up/down on game stories (already exists for other sections)
- [ ] Quality gate: review 50+ generated stories across sports. If >20% have filler or inaccuracies, do not ship to public
- [ ] Test: E2E for story rendering, feedback submission

## Phase 6 — PWA & Offline

**Goal**: Make the app installable and functional offline. Reveal state and preferences must persist across sessions and survive connectivity gaps.

**Exit criteria**: App installable from browser. Reveal state works offline. Cached game data shown when disconnected.

- [ ] Implement service worker with cache strategies: Cache First for static assets, Stale-While-Revalidate for game data
- [ ] Migrate reveal state persistence to IndexedDB (service worker accessible, larger capacity than localStorage)
- [ ] Build offline queue: buffer reveal actions, setting changes during offline → sync on reconnect
- [ ] Add install prompt: subtle, non-modal, shown after 2+ sessions
- [ ] Implement background sync: service worker `sync` event flushes offline queue
- [ ] Add offline indicator: subtle banner when disconnected, auto-dismiss on reconnect
- [ ] Handle IndexedDB versioning: incremental migrations in `openDB()` upgrade function
- [ ] Consider cross-device sync via anonymous token + free KV store (Upstash or Cloudflare Workers KV)
- [ ] Test: E2E for offline data display, online recovery, install prompt

## Phase 7 — Freemium Monetization

**Goal**: Introduce a paid tier that feels fair and brand-consistent. No aggressive ads.

**Exit criteria**: Free/Pro tiers live. Pro has clear value. Ads (if any) are non-intrusive and never interrupt score/reveal moments.

- [ ] Define tier structure:
  - **Free**: Core games feed, reveal mode, basic FairBet (limited markets/books), ad-supported
  - **Pro** (~$4.99-9.99/mo): Full FairBet access, all books/markets, real-time odds, no ads, cross-device sync, advanced filters
- [ ] Implement feature gates: real-time vs. delayed data as primary conversion lever
- [ ] Add "see what you're missing" preview: blurred FairBet cards with EV visible but details gated
- [ ] Design upgrade flow: inline upgrade prompts at natural gate points, not modal interruptions
- [ ] If ads: native list-item format only (renders as game card with "Ad" badge), no interstitials, no video, no layout shift
- [ ] Ad placement rules: never between game rows during live action, never during reveal gesture, never on game detail primary sections
- [ ] Consider sportsbook affiliate integration: native card format, CPA-based revenue, age-gated
- [ ] Add subscription management: Stripe integration, pause/cancel flow, retention offer at cancellation
- [ ] Test: E2E for gate behavior, upgrade flow, ad rendering (if applicable)

## Phase 8 — Golf (Conditional)

**Goal**: Add golf only when quality bar is met and a major tournament is live. Not a permanent nav item — eventized.

**Exit criteria**: Golf surface is polished enough that it strengthens (not dilutes) the brand during a major tournament.

**This phase is conditional.** Only proceed when:
1. A PGA major is approaching and golf data quality is verified
2. Golf UX is polished to the same standard as Games core
3. Adding golf doesn't dilute the "what is this app?" answer

- [ ] Evaluate golf data API quality: latency, accuracy, update frequency during tournament
- [ ] Design eventized golf entry: nav item appears only during live major tournaments, hidden otherwise
- [ ] Polish leaderboard: player scores, position changes, round-by-round breakdown
- [ ] Add reveal mode for golf: hide leaderboard positions, reveal on demand (same pattern as games)
- [ ] Ensure mobile leaderboard is usable (horizontal scroll or simplified view)
- [ ] Test: E2E for golf leaderboard, tournament list, reveal mode

## Phase 9 — Advanced FairBet & Analytics

**Goal**: Unlock power-user features for Pro subscribers. This is where the analytics work becomes user-facing.

**Exit criteria**: Pro users have access to CLV tracking, simulation tools, and advanced model surfaces.

- [ ] Closing Line Value (CLV) tracking: compare user's bet odds to closing odds over time
- [ ] Build CLV dashboard: win/loss record, CLV over time, which books/markets are most profitable
- [ ] Expose simulator to Pro users: team-picker Monte Carlo simulation (existing analytics feature, repackaged)
- [ ] Add model surfaces for Pro: win probability, expected value by market, confidence intervals
- [ ] Design advanced FairBet filters: by confidence level, by market type, by sport, by time-to-game
- [ ] Consider API access tier ($24.99+/mo): programmatic access to fair odds, CLV data
- [ ] Evaluate making history page Pro-only: full game archive, bet tracking, performance over time
- [ ] Test: E2E for CLV dashboard, simulator, advanced filters

---

## Research Index

Detailed research backing these phases lives in `docs/research/`:

| Topic | File | Informs Phase |
|-------|------|--------------|
| Score reveal UX patterns | `score-reveal-ux-patterns.md` | 1 |
| Sports app trust signals | `sports-app-trust-signals.md` | 2 |
| Competitor UX audit | `competitor-ux-audit.md` | 2, 3 |
| Live scores APIs | `live-scores-api.md` | 2 |
| Sports data APIs | `sports-data-apis.md` | 2 |
| Realtime WebSocket patterns | `realtime-websocket-patterns.md` | 2 |
| Fair value & EV calculation | `fair-value-ev-calculation.md` | 4 |
| Betting odds APIs | `betting-odds-api.md`, `betting-odds-apis.md` | 4 |
| AI sports summary quality | `ai-sports-summary-quality.md` | 5 |
| PWA offline score caching | `pwa-offline-score-caching.md` | 6 |
| Freemium monetization | `freemium-sports-app-monetization.md` | 7 |
| Non-intrusive ad formats | `non-intrusive-ad-formats.md` | 7 |
| Golf data APIs | `golf-data-apis.md` | 8 |
