# Development

Guide for local development, testing, and debugging across both platforms.

---

## iOS

### Environments

The iOS app supports three runtime environments via `AppConfig.shared.environment`:

| Mode | Description | Use Case |
|------|-------------|----------|
| `.live` | Production backend API | Default, real data |
| `.localhost` | Local dev server (port 8000) | Backend development |
| `.mock` | Generated local data via `MockGameService` | Offline development |

**Default:** Live mode. Mock mode does not provide flow data, team colors, or unified timelines.

### Switching Modes

```swift
// In code
AppConfig.shared.environment = .localhost
```

**Note:** The Admin Settings UI (`AdminSettingsView`) exists but the long-press trigger on the freshness text is not currently rendered in the home layout. Access admin settings by setting `showingAdminSettings = true` in code.

## Mock Data

Static mock JSON lives in `ScrollDown/Sources/Mock/games/`:

| File | Content |
|------|---------|
| `game-list.json` | Sample game feed |
| `game-001.json` | Full game detail |
| `game-002.json` | Full game detail (variant) |
| `pbp-001.json` | Play-by-play events |
| `social-posts.json` | Social post samples |

`MockDataGenerator` dynamically creates games with realistic data. The mock service uses a fixed dev clock (November 12, 2024) so temporal grouping behaves consistently.

**Note:** Mock service does not generate flow data, team colors, or unified timelines. These come from the real API only.

## Building & Testing

```bash
# Build for simulator
xcodebuild -scheme ScrollDown -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# Run tests
xcodebuild test -scheme ScrollDown -destination 'platform=iOS Simulator,name=iPhone 17 Pro'

# Clean build
xcodebuild -scheme ScrollDown clean build
```

## Snapshot Mode (Time Override)

Freeze the app to a specific date to test historical data. **Debug builds only.**

```bash
export IOS_BETA_ASSUME_NOW=2024-10-23T04:00:00Z
```

Or use Admin Settings (see note above about current access).

See [beta-time-override.md](beta-time-override.md) for full documentation.

## QA Checklist

### UI
- [ ] System, light, and dark themes
- [ ] Long team names and 4-char abbreviations display correctly
- [ ] iPad adaptive layout (4-column grid, constrained content width)
- [ ] PBP tiers visually distinct (T1 badges, T2 accent lines, T3 dots)

### Data
- [ ] Empty states show contextual messages
- [ ] Loading skeletons appear
- [ ] Team stats show all API-returned fields (not just a fixed subset)
- [ ] Section collapse states persist within session
- [ ] Search filters games by team name
- [ ] Reading position saves on scroll and restores on re-open
- [ ] Score reveal respects user preference (onMarkRead, always)
- [ ] Hold-to-reveal shows score on demand (long press on score area)
- [ ] Live games support hold-to-update for fresh scores
- [ ] `markRead` is silently ignored for non-final games
- [ ] Catch-up button bulk-reveals all scores (iPad: filter bar, iPhone: action row)
- [ ] Reset button undoes catch-up (marks unread, clears saved positions/scores)
- [ ] FairBet first page loads immediately, remaining pages load progressively in background

### Live Games
- [ ] Live game detail shows PBP as primary content (not Game Flow)
- [ ] Auto-polling starts for live games (~45s interval)
- [ ] Polling stops on dismiss or game transitioning to final
- [ ] Game transitioning to final re-renders view based on new status (shows flow if loaded, PBP as fallback)
- [ ] Header shows pulsing LIVE badge with live score
- [ ] Auto-resume scrolls to saved position when returning to a game (default ON)
- [ ] Resume prompt appears when auto-resume is toggled OFF in Settings
- [ ] Auto-resume setting toggle appears in Settings under "Game — Behavior"

### Navigation
- [ ] Scrolling stable when expanding sections
- [ ] Back navigation preserves state
- [ ] Games/FairBet/Settings tabs work
- [ ] Team headers are tappable

## Debugging

### Console logs
Filter by subsystem `com.scrolldown.app` in Console.app:

| Category | Content |
|----------|---------|
| `time` | Snapshot mode events |
| `routing` | Navigation and game routing |
| `networking` | API calls and responses |
| `teamColors` | Team color cache loading |
| `timeline` | Timeline and flow loading |

### Common Issues

**Flow not loading:**
- Check `viewModel.hasFlowData` returns true
- Verify API responses in network logs
- Confirm game has flow data generated (not all games have flow)

**Team colors showing default indigo:**
- Check `TeamColorCache` loaded successfully (filter logs by `teamColors`)
- Verify `/api/admin/sports/teams` returns color hex values for the team
- Cache expires after 7 days — force refresh by clearing UserDefaults

**Timeline artifact empty:**
- Check `timelineArtifactState` — should be `.loaded`
- Verify `/api/admin/sports/games/{id}/timeline` returns a `TimelineArtifactResponse` with `timelineJson`
- Not all games have timeline artifacts generated
- Flow-based timeline (`buildUnifiedTimelineFromFlow`) is the primary PBP source for completed games

---

## Web

### Setup

```bash
cd web
cp .env.local.example .env.local   # Add your SPORTS_DATA_API_KEY
npm install
npm run dev                         # http://localhost:3000
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend API base URL |
| `SPORTS_DATA_API_KEY` | Yes | API authentication (server-side only, never exposed to browser) |

See `web/.env.local.example` for local development and `web/.env.production.example` for production.

### Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (standalone output) |
| `npm start` | Start production server |
| `npm run lint` | ESLint check |
| `npx tsc --noEmit` | TypeScript type check |

### Docker (Local)

```bash
cd web
docker build -t scrolldown-web .
docker run -p 3000:3000 --env-file .env.local scrolldown-web
```

### Web QA Checklist

- [ ] Home page loads with date sections (Earlier, Yesterday, Today, Tomorrow)
- [ ] League filter works (All, NBA, NCAAB, NHL)
- [ ] Search filters by team name
- [ ] Game card taps navigate to game detail
- [ ] Game detail sections render (Overview, Timeline, Stats, Odds, Wrap-Up)
- [ ] Flow blocks display for completed games
- [ ] FairBet page loads odds with progressive pagination
- [ ] BetCard shows EV, fair odds, book chips
- [ ] FairExplainer sheet opens on fair odds tap
- [ ] Theme toggle works (system, light, dark)
- [ ] Score reveal mode toggle works
- [ ] Reading position saves and restores on return

### Web Common Issues

**API errors (500):**
- Check `SPORTS_DATA_API_KEY` is set in `.env.local`
- Check `NEXT_PUBLIC_API_BASE_URL` points to a running backend
- Check browser Network tab for the failing `/api/*` request

**Stale data after code changes:**
- `npm run dev` hot-reloads components but API route changes may need a server restart
- Delete `.next/` directory for a clean build if caching issues persist

**Type errors:**
- Run `npx tsc --noEmit` to check all types
- Web types are in `web/src/lib/types.ts` — keep in sync with API responses
