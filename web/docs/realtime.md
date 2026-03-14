# Realtime System

## Transport

The realtime system uses a two-tier transport with automatic failover:

1. **WebSocket** (primary) — connects to `wss://<backend>/v1/ws`
2. **SSE** (fallback) — connects via `/api/realtime/sse` proxy (because `EventSource` cannot set custom headers, the proxy injects the API key)
3. **Offline** — graceful degradation with cache + polling

### Failover Logic

- If WebSocket fails **2 times within 60 seconds**, transport switches to SSE
- SSE runs for **5 minutes**, then attempts to reconnect via WebSocket
- Reconnection uses exponential backoff: **1s initial, 30s maximum**

All failover thresholds are configured in `src/lib/config.ts` under `REALTIME`.

## Event Types

| Event | Channel Pattern | Payload | Effect |
|-------|----------------|---------|--------|
| `game_patch` | `game:<id>:summary` | Partial game core fields | Patches score, status, clock in store |
| `pbp_append` | `game:<id>:pbp` | New play entries | Appends to play list (deduped by eventId) |
| `fairbet_patch` | `fairbet:*` | — | Triggers full FairBet re-fetch |

List channels (`games:<league>:<date>`) receive `game_patch` events for all games in that list.

## Dispatcher

A single global event handler (`src/realtime/dispatcher.ts`) routes all incoming events into the Zustand `game-data` store. Initialized once by `RealtimeProvider`.

### Sequence Gap Handling

Each channel maintains a sequence number. On every event:

1. **Duplicate** (seq already seen) — silently dropped
2. **Gap** (seq skipped) — channel marked as desynced, recovery triggered
3. **Normal** (seq increments by 1) — event applied, seq committed

### Recovery

When a gap is detected:

- **List channel** (`games:nba:2026-03-05`) — triggers full list re-fetch
- **Game summary** (`game:123:summary`) — triggers game detail re-fetch
- **PBP** (`game:123:pbp`) — triggers PBP re-fetch
- **FairBet** — triggers odds re-fetch

Recovery is **throttled per channel**: minimum 8 seconds between recovery requests for the same channel.

## Subscriptions

Components subscribe to channels via `useRealtimeSubscription` hook:

- **Home page**: subscribes to all game-list channels for the current date range
- **Game detail**: subscribes to `game:<id>:summary` always; subscribes to `game:<id>:pbp` only when Timeline section is expanded
- **FairBet**: subscribes to `fairbet:odds`

Subscriptions are registered/unregistered as components mount/unmount.

## Visibility Refresh

Separate from realtime events, the `useVisibilityRefresh` hook watches for tab visibility changes:

- Tab hidden > 5 seconds — triggers a full HTTP re-fetch on return
- This catches any events missed while the tab was backgrounded (browsers may throttle WebSocket/SSE in hidden tabs)
- Live games always trigger visibility refresh; non-live only when realtime is offline

## Status Tracking

`useRealtimeStatus` tracks connection state (connected/disconnected/degraded) and per-channel desync status. This information is available for diagnostic purposes but is **not displayed to end users**.
