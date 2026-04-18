# Scroll Down Sports

A clean web app for following games on your own terms — trusted scores, controlled reveal mode, live updates when you want them, and betting context that actually helps.

## Tech Stack

- **Framework**: Next.js 16 (App Router only) + React 19 + TypeScript 6
- **State**: Zustand 5 (no Redux, no MobX)
- **Styling**: Tailwind CSS 4 via `@tailwindcss/postcss` — CSS variable theming (never use `dark:` prefix)
- **Testing**: Playwright E2E only — no unit test framework, no Jest, no Vitest
- **Deploy**: Standalone build → Docker → Hetzner VPS
- **Realtime**: WebSocket primary → SSE fallback → polling degraded

## Dev Setup

```bash
cd web
npm ci
cp .env.local.example .env.local   # fill in API keys
npm run dev                   # localhost:3001
```

## Code Style

- Strict TypeScript — no `any`, no `@ts-ignore`
- No Prettier — ESLint only (`npm run lint`)
- Double quotes in JSX attributes
- Run `npm run lint` before every commit

## Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Component files | PascalCase `.tsx` | `GameHeader.tsx` |
| Store files | kebab-case `.ts` | `game-data.ts` |
| Hooks | `use` prefix, camelCase | `useGameDetail.ts` |
| Lib utilities | kebab-case `.ts` | `fairbet-utils.ts` |
| Constants | `SCREAMING_SNAKE_CASE` | `CACHE_TTL_GAMES` |
| `data-testid` | kebab-case | `game-header`, `bet-card` |
| Realtime channels | colon-delimited | `game:123:pbp` |

## Testing

- E2E only with Playwright (`npm test`)
- `@smoke` tag for CI subset (`npm run test:smoke`)
- Tests skip gracefully when live data is unavailable — never hard-fail on API variance
- Auth fixture: `authedPage` from `tests/helpers.ts`
- All interactive elements need `data-testid` for selectors

## Dependencies — What NOT to Add

- No unit test framework (Jest, Vitest, etc.)
- No Redux, MobX, or other state libraries
- No axios — use `src/lib/api.ts` (client) or `src/lib/api-server.ts` (server)
- No client-side database packages (Dexie, etc.) — localStorage + Zustand only for now
- No Prettier — ESLint handles formatting
- Adding a new external domain requires updating CSP in `next.config.ts`

## Architecture Rules

### API Proxy

All backend calls go through Next.js API routes (`src/app/api/`). The proxy injects `X-API-Key` server-side so the key never reaches the browser. Never call `sda.dock108.dev` directly from client code.

### Score Reveal Invariants

The reveal system is the product's core differentiator. Never break these:

1. Scores are hidden by default in `onMarkRead` mode — user must explicitly reveal
2. Reveal state persists in localStorage (`sd-read-state`) — refreshing the page does not re-hide
3. Following Live mode overrides reveal to show live scores continuously
4. Snapshots capture score at reveal time — used to detect "new data since you last looked"
5. Max 500 revealed IDs, 20 snapshots — bounded by `src/lib/config.ts`

### Realtime

- Sequence numbers tracked per channel — gaps trigger recovery (full re-fetch)
- WebSocket fails 2x in 60s → auto-fallback to SSE for 5 minutes → retry WS
- Recovery throttled: min 8s between recovery requests per channel
- Tab visibility: re-fetch on return after 5+ seconds hidden

### Config

All magic numbers (cache TTLs, polling intervals, storage limits, realtime thresholds) live in `src/lib/config.ts`. Do not scatter constants across files.

### Security Headers

Configured in `next.config.ts`. CSP restricts script/connect sources. If adding a new external service, update the CSP directive — the build will work but the browser will block it silently.

## Git

- Branch naming: `feat/`, `fix/`, `chore/` prefix
- Commit messages: imperative mood with scope prefix (e.g., `feat(fairbet): add EV tooltip`)
- PRs target `main`

## Important Rules

1. **No unit tests** — Playwright E2E only. Do not add Jest, Vitest, or any unit framework.
2. **Standalone build** — `npm run build` copies files to `standalone/`. The Docker image runs `node server.js`, not `next start`. If you add static assets, make sure the build script copies them.
3. **CSS variables for theming** — use CSS custom properties, never Tailwind `dark:` prefix.
4. **App Router only** — no `pages/` directory, no `getServerSideProps`.
5. **No secrets in source** — API keys go in `.env.local`, injected server-side via API proxy routes.
6. **Types in `src/lib/types.ts`** — all API response types live here (500+ lines). Check here before creating new type files.
7. **Existing docs** — detailed architecture docs live in `docs/`. Read them before making structural changes.
8. **Product focus** — the public app is Games + FairBet. Analytics, Golf, and History are secondary/admin surfaces. Don't add new public nav items without discussion.
