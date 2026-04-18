"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { useMyBets } from "@/stores/my-bets";
import { useTier } from "@/stores/tier";
import { formatOdds } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import type { LoggedBet } from "@/lib/types";

function clvLabel(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function clvColor(pct: number): string {
  if (pct > 0) return "var(--ev-good-text, #4ade80)";
  if (pct < 0) return "var(--ev-negative-text, #f87171)";
  return "var(--ds-text-tertiary)";
}

function BetRow({ bet, oddsFormat, onRemove }: {
  bet: LoggedBet;
  oddsFormat: "american" | "decimal" | "fractional";
  onRemove: (id: string) => void;
}) {
  const date = new Date(bet.loggedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <tr
      className="border-b"
      style={{ borderColor: "var(--fb-border-subtle)" }}
      data-testid="my-bets-row"
    >
      <td className="py-2 pr-3 text-xs text-neutral-400 whitespace-nowrap">{date}</td>
      <td className="py-2 pr-3 text-xs text-neutral-200 max-w-[140px]">
        <div className="truncate">{bet.selectionDisplay}</div>
        <div className="text-[10px] text-neutral-500 truncate">{bet.marketLabel}</div>
      </td>
      <td className="py-2 pr-3 text-xs text-neutral-300 whitespace-nowrap">{bet.book}</td>
      <td className="py-2 pr-3 text-xs font-semibold text-neutral-100 whitespace-nowrap">
        {formatOdds(bet.placedOdds, oddsFormat)}
      </td>
      <td className="py-2 pr-3 text-xs text-neutral-400 whitespace-nowrap">
        {bet.closingOdds != null ? formatOdds(bet.closingOdds, oddsFormat) : "—"}
      </td>
      <td className="py-2 pr-3 text-xs font-semibold whitespace-nowrap">
        {bet.clvPercent != null ? (
          <span style={{ color: clvColor(bet.clvPercent) }} data-testid="clv-percent">
            {clvLabel(bet.clvPercent)}
          </span>
        ) : (
          <span className="text-neutral-600">—</span>
        )}
      </td>
      <td className="py-2 text-xs">
        <button
          onClick={() => onRemove(bet.id)}
          className="text-neutral-600 hover:text-neutral-400 transition text-[10px]"
          aria-label="Remove bet"
          data-testid="my-bets-remove"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export default function MyBetsPage() {
  const isPro = useTier((s) => s.tier) === "pro";
  const { bets, removeBet, clearAll, updateClosingOdds } = useMyBets();
  const oddsFormat = useSettings((s) => s.oddsFormat);

  // On load: try to fetch closing odds for bets that lack them
  const fetchClosingOdds = useCallback(async () => {
    const pending = bets.filter((b) => b.closingOdds == null);
    if (pending.length === 0) return;

    // Group by gameId to minimize requests
    const byGame = new Map<number, LoggedBet[]>();
    for (const b of pending) {
      const arr = byGame.get(b.gameId) ?? [];
      arr.push(b);
      byGame.set(b.gameId, arr);
    }

    for (const [gameId, gameBets] of byGame) {
      try {
        const res = await fetch(`/api/fairbet/odds?game_id=${gameId}`, {
          credentials: "same-origin",
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { bets?: Array<{
          game_id: number;
          market_key: string;
          selection_key: string;
          best_book?: string;
          books?: Array<{ book: string; price: number }>;
        }> };

        for (const logged of gameBets) {
          const match = (data.bets ?? []).find(
            (b) =>
              b.game_id === logged.gameId &&
              b.market_key === logged.marketKey,
          );
          if (!match) continue;
          // Use the best available price from the book the bet was placed at, else overall best
          const bookPrice = match.books?.find(
            (bp) => bp.book.toLowerCase() === logged.book.toLowerCase(),
          )?.price;
          const bestPrice = match.books?.find((bp) => bp.book === match.best_book)?.price;
          const closing = bookPrice ?? bestPrice;
          if (closing != null) {
            updateClosingOdds(logged.id, closing);
          }
        }
      } catch {
        // network error — skip silently
      }
    }
  }, [bets, updateClosingOdds]);

  useEffect(() => {
    fetchClosingOdds();
    // intentionally run once on mount; fetchClosingOdds ref is stable across rerenders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isPro) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-neutral-100">My Bets</h1>
        <p className="text-sm text-neutral-500">
          CLV tracking is a Pro feature.{" "}
          <Link href="/fairbet" className="underline" style={{ color: "var(--fb-info)" }}>
            Upgrade to Pro
          </Link>{" "}
          to log bets and track closing line value.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4" data-testid="my-bets-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-neutral-100">My Bets</h1>
          <Link
            href="/settings/my-bets/dashboard"
            className="text-xs font-medium px-2 py-1 rounded transition"
            style={{ color: "var(--fb-info)", background: "var(--fb-accent-subtle)" }}
            data-testid="my-bets-dashboard-link"
          >
            Dashboard →
          </Link>
        </div>
        {bets.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-neutral-500 hover:text-neutral-400 transition"
            data-testid="my-bets-clear-all"
          >
            Clear all
          </button>
        )}
      </div>

      {bets.length === 0 ? (
        <p className="text-sm text-neutral-500" data-testid="my-bets-empty">
          No bets logged yet. Tap{" "}
          <span className="font-medium text-neutral-300">&ldquo;+ Log bet&rdquo;</span> on any
          FairBet card to start tracking.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[480px] text-left border-collapse">
            <thead>
              <tr
                className="border-b text-[10px] uppercase text-neutral-600"
                style={{ borderColor: "var(--fb-border-subtle)" }}
              >
                <th className="pb-2 pr-3 font-medium">Date</th>
                <th className="pb-2 pr-3 font-medium">Market</th>
                <th className="pb-2 pr-3 font-medium">Book</th>
                <th className="pb-2 pr-3 font-medium">Placed</th>
                <th className="pb-2 pr-3 font-medium">Closing</th>
                <th className="pb-2 pr-3 font-medium">CLV%</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {bets.map((bet) => (
                <BetRow
                  key={bet.id}
                  bet={bet}
                  oddsFormat={oddsFormat}
                  onRemove={removeBet}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-neutral-600">
        Up to {200} bets stored locally. Closing line fetched from the FairBet odds feed.
      </p>
    </div>
  );
}
