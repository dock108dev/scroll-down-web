"use client";

import { useEffect, useState } from "react";
import { useFairBetLive } from "@/hooks/useFairBetLive";
import { FairBetTheme } from "@/lib/theme";
import { api } from "@/lib/api";
import type {
  LiveSnapshot,
  ClosingLine,
  LiveHistoryEntry,
} from "@/lib/types";

interface LiveGame {
  game_id: number;
  home_team: string;
  away_team: string;
  league: string;
}

const MARKET_OPTIONS = [
  { value: "", label: "All Markets" },
  { value: "spread", label: "Spread" },
  { value: "total", label: "Total" },
  { value: "moneyline", label: "Moneyline" },
];

export function LiveOddsPanel() {
  const hook = useFairBetLive();
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);

  // Fetch today's live games for the picker
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.games();
        const live = (res.games ?? [])
          .filter((g) => g.isLive)
          .map((g) => ({
            game_id: g.id,
            home_team: g.homeTeam ?? "Home",
            away_team: g.awayTeam ?? "Away",
            league: g.leagueCode ?? "",
          }));
        if (!cancelled) {
          setLiveGames(live);
          // Auto-select first live game if none selected
          if (live.length > 0 && hook.gameId === null) {
            hook.setGameId(live[0].game_id);
          }
        }
      } catch {
        // ignore — user can still manually enter game id
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {/* Game Picker */}
      <div className="flex flex-wrap gap-2">
        <select
          value={hook.gameId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            hook.setGameId(v ? Number(v) : null);
          }}
          className="flex-1 min-w-0 text-sm rounded-lg px-3 py-2 bg-[var(--fb-surface-secondary)] text-neutral-200 border border-[var(--fb-border-subtle)] outline-none"
        >
          <option value="">
            {gamesLoading
              ? "Loading games..."
              : liveGames.length === 0
                ? "No live games"
                : "Select a game"}
          </option>
          {liveGames.map((g) => (
            <option key={g.game_id} value={g.game_id}>
              {g.away_team} @ {g.home_team} ({g.league})
            </option>
          ))}
        </select>

        <select
          value={hook.marketKey}
          onChange={(e) => hook.setMarketKey(e.target.value)}
          className="text-sm rounded-lg px-3 py-2 bg-[var(--fb-surface-secondary)] text-neutral-200 border border-[var(--fb-border-subtle)] outline-none"
        >
          {MARKET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          onClick={hook.refetch}
          disabled={hook.gameId === null}
          className="text-xs font-medium px-3 py-2 rounded-lg transition disabled:opacity-40"
          style={{
            backgroundColor: "var(--fb-surface-secondary)",
            border: "1px solid var(--fb-border-subtle)",
            color: "var(--fb-info)",
          }}
        >
          Refresh
        </button>
      </div>

      {/* States */}
      {hook.loading && (
        <div className="py-12 text-center text-sm text-neutral-500">
          Loading live odds...
        </div>
      )}

      {hook.error && (
        <div className="py-12 text-center space-y-3">
          <div className="text-sm" style={{ color: FairBetTheme.negative }}>
            {hook.error}
          </div>
          <button
            onClick={hook.refetch}
            className="text-xs font-medium px-4 py-1.5 rounded-lg text-neutral-400"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!hook.loading && !hook.error && hook.gameId === null && (
        <div className="py-12 text-center text-sm text-neutral-500">
          Select a live game to view in-game odds movement.
        </div>
      )}

      {/* Data */}
      {!hook.loading && !hook.error && hook.data && (
        <div className="space-y-4">
          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>{hook.data.meta.league}</span>
            {hook.data.meta.live_updated_at && (
              <span>
                Updated{" "}
                {new Date(hook.data.meta.live_updated_at).toLocaleTimeString()}
              </span>
            )}
            <span>{hook.data.meta.closing_count} closing lines</span>
          </div>

          {/* Closing Lines */}
          {hook.data.closing.length > 0 && (
            <ClosingLinesSection closing={hook.data.closing} />
          )}

          {/* Live Snapshot(s) */}
          {hook.data.live && <LiveSection live={hook.data.live} marketKey={hook.data.market_key} />}

          {/* History */}
          {hook.data.history.length > 0 && (
            <HistorySection history={hook.data.history} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-sections ──────────────────────────────────────────

function ClosingLinesSection({ closing }: { closing: ClosingLine[] }) {
  // Group by market_key
  const byMarket = new Map<string, ClosingLine[]>();
  for (const c of closing) {
    const arr = byMarket.get(c.market_key) ?? [];
    arr.push(c);
    byMarket.set(c.market_key, arr);
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
        Closing Lines
      </h3>
      {Array.from(byMarket.entries()).map(([market, lines]) => (
        <div
          key={market}
          className="rounded-xl p-3 space-y-1.5"
          style={{
            backgroundColor: "var(--fb-card-bg)",
            border: "1px solid var(--fb-border-subtle)",
          }}
        >
          <div className="text-xs font-medium text-neutral-300 capitalize">
            {market}
          </div>
          <div className="flex flex-wrap gap-2">
            {lines.map((l, i) => (
              <div
                key={i}
                className="text-xs px-2.5 py-1.5 rounded-lg"
                style={{ backgroundColor: "var(--fb-surface-secondary)" }}
              >
                <span className="text-neutral-400">{l.selection}</span>{" "}
                {l.line_value != null && (
                  <span className="text-neutral-300">
                    {l.line_value > 0 ? "+" : ""}
                    {l.line_value}
                  </span>
                )}{" "}
                <span
                  className="font-semibold"
                  style={{ color: FairBetTheme.info }}
                >
                  {formatAmerican(l.price_american)}
                </span>
                <span className="text-neutral-600 ml-1.5">
                  {l.provider}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveSection({
  live,
  marketKey,
}: {
  live: LiveSnapshot | Record<string, LiveSnapshot>;
  marketKey?: string;
}) {
  // If marketKey was specified, live is a single snapshot; otherwise it's keyed by market
  const snapshots: [string, LiveSnapshot][] = marketKey
    ? [[marketKey, live as LiveSnapshot]]
    : Object.entries(live as Record<string, LiveSnapshot>);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
        Live Lines
      </h3>
      {snapshots.map(([market, snap]) => (
        <div
          key={market}
          className="rounded-xl p-3 space-y-1.5"
          style={{
            backgroundColor: "var(--fb-card-bg)",
            border: "1px solid var(--fb-border-subtle)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-neutral-300 capitalize">
              {market}
            </div>
            <div className="text-[10px] text-neutral-600">
              {snap.provider} &middot; TTL {Math.round(snap.ttl_seconds_remaining / 60)}m
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {snap.selections.map((sel, i) => (
              <div
                key={i}
                className="text-xs px-2.5 py-1.5 rounded-lg"
                style={{ backgroundColor: "var(--fb-surface-secondary)" }}
              >
                <span className="text-neutral-400">{sel.selection}</span>{" "}
                {sel.line != null && (
                  <span className="text-neutral-300">
                    {sel.line > 0 ? "+" : ""}
                    {sel.line}
                  </span>
                )}{" "}
                <span
                  className="font-semibold"
                  style={{ color: FairBetTheme.positive }}
                >
                  {formatAmerican(sel.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistorySection({ history }: { history: LiveHistoryEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? history : history.slice(0, 10);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
          Movement History ({history.length})
        </h3>
        {history.length > 10 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[10px] font-medium"
            style={{ color: FairBetTheme.info }}
          >
            {expanded ? "Collapse" : `Show all ${history.length}`}
          </button>
        )}
      </div>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--fb-card-bg)",
          border: "1px solid var(--fb-border-subtle)",
        }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="text-neutral-500 border-b border-neutral-800">
              <th className="text-left px-3 py-1.5 font-medium">Time</th>
              <th className="text-left px-3 py-1.5 font-medium">Selections</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((h, i) => (
              <tr
                key={i}
                className="border-b border-neutral-800/50 last:border-0"
              >
                <td className="px-3 py-1.5 text-neutral-400 whitespace-nowrap">
                  {new Date(h.t * 1000).toLocaleTimeString()}
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {h.selections.map((s, j) => (
                      <span key={j} className="text-neutral-300">
                        {s.s}
                        {s.l != null && (
                          <span className="text-neutral-500">
                            {" "}
                            {s.l > 0 ? "+" : ""}
                            {s.l}
                          </span>
                        )}
                        {" "}
                        <span style={{ color: FairBetTheme.info }}>
                          {formatAmerican(s.p)}
                        </span>
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatAmerican(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}
