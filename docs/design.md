# Design Principles & Patterns

The customer-voice direction lives in [`BRAINDUMP.md`](../../BRAINDUMP.md) at the workspace root (one level above this repo). This file is the developer-facing translation: what the principles imply for code organization, naming, and component composition. When the two disagree, BRAINDUMP wins.

## Principles

### 1. The field is the stage

The catch-up viewer is composed as `field = stage / scoreboard = instrumentation / narration = subtitle layer`. Don't treat the scoreboard, field, and captions as equal-weight panels. The field is the emotional core; everything else supports it.

Practical implications:
- Field rendering (`BaseballLightField.tsx`) gets the dominant share of the catch-up card.
- Scoreboard / instrumentation chrome is thin and quiet. Avoid decorative borders and equal-weight chips.
- Narration (`CardNarrative.tsx`) is restrained typography — never compete with the field.

### 2. Geometry is canonical

There is one source of truth for field coordinates: `web/src/lib/field-geometry.ts`. Foul lines, base spacing, mound offset, outfield arc, runner-path curves, and trajectory launch anchors all derive from it. **No duplicated geometry constants anywhere.**

Trajectory + runner code (`trajectory.ts`, `runner-paths.ts`) consume `FIELD_GEOMETRY` and never hand-tune positions. If a visual primitive needs to render relative to the field, it derives from this module.

### 3. Determinism over freshness theater

The catch-up deck is a function of `(game, plays, mlbPitchers)` — same inputs, same deck. The selection (`buildCatchupCards`) and rhythm planning (`planDeckWithReport`) are pure. Tier-2 sampling is seeded by `gameId`, so dev-lab fixtures and production deck for the same game match exactly.

Don't introduce wall-clock-dependent randomness, `Math.random()`, or "freshness" effects on top of pure pipeline output. If you need the sample to change, change the inputs (e.g. include a new salient play class) — don't shuffle.

### 4. Spoiler-safe by default

No surface should leak the final score before the user reaches the FinalReveal. The home feed strips score and win fields server-side (`/api/games/recent`). The card deck never includes the final tally; only the FinalReveal screen does. Avoid adding "summary" UI that surfaces score early.

### 5. Quiet trust signals

When upstream data is stale, surface that softly:

- `DegradedBanner` appears only when `/api/health` is degraded.
- `useSettings.showStaleBanners` defaults to `true`; users can silence them.
- Don't animate finals. Animation signals "this is changing." Final games are static.

### 6. Restraint as identity

Do **not** add: betting, stat overload, social feeds, ticker clutter, AI summaries, pop-up tutorials, or auth gates. The product wins by being the small, atmospheric thing it already is. New capability earns its way in by proving it strengthens the broadcast-machine identity.

## Patterns

### Zustand store shape

All three stores follow the same shape: state + actions in one `create()` call, `persist` middleware with an explicit `version` and `migrate` that drops fields that no longer exist on the type.

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/config";

interface SettingsState {
  theme: "system" | "light" | "dark";
  showStaleBanners: boolean;
  setTheme: (t: SettingsState["theme"]) => void;
  setShowStaleBanners: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: DEFAULTS.THEME as SettingsState["theme"],
      showStaleBanners: true,
      setTheme: (theme) => set({ theme }),
      setShowStaleBanners: (showStaleBanners) => set({ showStaleBanners }),
    }),
    { name: STORAGE_KEYS.SETTINGS, version: 2, migrate: /* drop legacy fields */ },
  ),
);
```

The `migrate` step is mandatory whenever the persisted shape changes — see `web/src/stores/settings.ts:28` for the v1→v2 example that strips score-reveal mode, blacklists, etc.

### Server-side data fetching

Server-side route handlers reach upstream via `apiFetch`/`cachedApiFetch` in `web/src/lib/api-server.ts`. Never call `fetch()` to `sda.dock108.dev` directly — the helpers inject the API key, set a default 5s timeout, and apply mojibake repair to the JSON body.

Cache windows live in `API.*` constants in `web/src/lib/config.ts`. Don't hardcode TTLs in route handlers.

### Client-side data fetching

Client hooks under `web/src/hooks/` poll Next.js API routes only — never the upstream backend, and never with bare `fetch()` to `sda.dock108.dev`. Polling cadence is read from `POLLING.*` in `config.ts`.

### Catch-up rendering

The deck is rendered by `CatchupExperience` which orchestrates `CatchupScrollContainer` over the cards returned from `useCatchupCards`. Each card type (`SceneSetterCard`, `RhythmCard`, `CatchupCard`, `FinalReveal`) is responsible only for its own visual; they share field geometry and progress state via the parent.

`RevealGate` enforces "you must reach the end" before `FinalReveal` exposes the score.

## Anti-patterns

- **Don't bypass `apiFetch`.** Direct `fetch("https://sda.dock108.dev/...")` from a route handler skips API-key injection, mojibake repair, and bounded error reads.
- **Don't compute field positions inline.** Derive from `FIELD_GEOMETRY` or extend that module.
- **Don't introduce a fourth store.** If you think you need one, the fact probably belongs on `useCatchupProgress` or in component-local state. The store count is a feature.
- **Don't reach for a realtime layer.** Polling is sufficient at the granularity this product needs and the cache windows in `config.ts` already cover the common live case.
- **Don't surface scores in feed-list metadata.** Strip server-side, before the JSON ever leaves the proxy.
- **Don't animate final scores or completed games.** Motion communicates change.
- **Don't add a "settings page" toggle for everything.** The settings store has two fields on purpose.

## Naming Conventions

| Category | Convention | Examples |
|----------|-----------|----------|
| Files / directories | kebab-case (lib) or PascalCase (components) | `catchup-cards.ts`, `BaseballLightField.tsx` |
| React components | PascalCase | `CatchupCard`, `FinalReveal` |
| Hooks | `use` prefix, camelCase | `useCatchupCards`, `useGamesList` |
| Constants | `SCREAMING_SNAKE_CASE` (top-level) or `PascalCase` for grouped configs | `LEAGUE`, `CATCHUP.TARGET_TOTAL` |
| `data-testid` | kebab-case | `game-row`, `catchup-card`, `final-reveal` |
| `localStorage` keys | `sd-` prefix, kebab-case | `sd-settings`, `sd-onboarding`, `sd-catchup-state` |

All persisted-storage keys live in `STORAGE_KEYS` in `web/src/lib/config.ts` — never inline them in store files.

## Error Handling

- **Upstream errors** are caught by `apiFetch` / `cachedApiFetch` (`ApiError` class). 401/403/502/503/504 are remapped to a `502` proxy status so the client doesn't think *it* has the auth problem. Error bodies are truncated to 200 chars in the surfaced message and 2 KB on `.body`.
- **Stale-if-error** falls back to the cached response when fresh fetch fails with 429 or 5xx, within the route's stale window.
- **React error boundaries** handle render-time crashes; don't blanket-wrap render code in try/catch.
- **Don't show stack traces, internal URLs, or upstream status codes to the user.** The proxy already remaps gateway errors to 502.

## Testing Strategy

Two layers (see `docs/testing.md` for the full layout):

- **Vitest** for the catch-up pipeline and pure helpers (`web/tests/unit/lib/`). Reach for unit tests when the logic is pure, deterministic, or a single-function contract.
- **Playwright** for product flows. Smoke is gated to `@smoke`-tagged tests in CI, with `@live-upstream` excluded on PR runs.

Pure-logic units (selection, planner, leverage, geometry, trajectory, runner paths, result-chip) are well-suited to Vitest and have working tests today; reach for E2E when the failure mode involves real DOM / scroll / IntersectionObserver behavior.
