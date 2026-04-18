"use client";

import { useState, useEffect, useCallback } from "react";
import type { GolfLeaderboardEntry } from "@/lib/types";
import { POLLING } from "@/lib/config";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

function formatScore(score: number) {
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreColor(score: number) {
  if (score < 0) return "text-red-400";
  if (score > 0) return "text-blue-400";
  return "text-neutral-300";
}

const CUT_STATUSES = new Set(["CUT", "WD", "DQ", "MDF"]);

function isMissedCut(entry: GolfLeaderboardEntry) {
  return CUT_STATUSES.has(entry.status.toUpperCase());
}

function PlayerRow({
  entry,
  dimmed,
  revealed,
  onToggle,
}: {
  entry: GolfLeaderboardEntry;
  dimmed: boolean;
  revealed: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <tr
      data-testid="golf-leaderboard-row"
      onClick={() => onToggle(entry.playerId)}
      className={[
        "border-b border-neutral-800/50 cursor-pointer transition-colors hover:bg-neutral-800/30",
        dimmed ? "opacity-50" : "",
      ].join(" ")}
      aria-label={`${entry.name} — tap to ${revealed ? "hide" : "reveal"} score`}
    >
      <td className="whitespace-nowrap py-2.5 pl-3 pr-2 text-xs font-medium text-neutral-400 w-10">
        {entry.position}
      </td>
      <td className="py-2.5 pr-3 text-sm text-neutral-50">{entry.name}</td>
      <td className="whitespace-nowrap py-2.5 px-2 text-center w-16">
        {revealed ? (
          <span
            className={`text-sm font-semibold ${scoreColor(entry.totalScore)}`}
            data-testid="golf-score-revealed"
          >
            {formatScore(entry.totalScore)}
          </span>
        ) : (
          <span
            className="inline-block text-sm font-semibold blur-sm select-none text-neutral-300"
            data-testid="golf-score-blurred"
            aria-hidden="true"
          >
            {formatScore(entry.totalScore)}
          </span>
        )}
      </td>
      <td
        className={`whitespace-nowrap py-2.5 px-2 text-center text-xs ${revealed ? scoreColor(entry.todayScore) : "text-neutral-600"}`}
      >
        {revealed ? formatScore(entry.todayScore) : "–"}
      </td>
      <td className="whitespace-nowrap py-2.5 px-2 text-center text-xs text-neutral-400">
        {entry.thru}
      </td>
    </tr>
  );
}

function CutLineSeparator() {
  return (
    <tr data-testid="cut-line">
      <td colSpan={5} className="py-1 px-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-neutral-700" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-600">
            Cut
          </span>
          <div className="h-px flex-1 bg-neutral-700" />
        </div>
      </td>
    </tr>
  );
}

export function GolfLeaderboard() {
  const [entries, setEntries] = useState<GolfLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/golf/leaderboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GolfLeaderboardEntry[] = await res.json();
      setEntries(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();

    const id = setInterval(() => {
      if (!document.hidden) fetchLeaderboard();
    }, POLLING.GOLF_LEADERBOARD_REFRESH_MS);

    return () => clearInterval(id);
  }, [fetchLeaderboard]);

  const toggleReveal = useCallback((playerId: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="py-6 space-y-2">
        <LoadingSkeleton variant="list" count={10} />
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-12 text-center text-sm text-neutral-500">
        Unable to load leaderboard.
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-neutral-500">
        No active tournament leaderboard available.
      </p>
    );
  }

  const madecut = entries.filter((e) => !isMissedCut(e));
  const missedcut = entries.filter(isMissedCut);

  return (
    <div data-testid="golf-leaderboard" className="overflow-x-auto">
      <table className="w-full min-w-[340px] text-left">
        <thead>
          <tr className="border-b border-neutral-700 text-[11px] uppercase tracking-wider text-neutral-500">
            <th className="py-2 pl-3 pr-2 font-medium">Pos</th>
            <th className="py-2 pr-3 font-medium">Player</th>
            <th className="py-2 px-2 text-center font-medium">Total</th>
            <th className="py-2 px-2 text-center font-medium">Today</th>
            <th className="py-2 px-2 text-center font-medium">Thru</th>
          </tr>
        </thead>
        <tbody>
          {madecut.map((e) => (
            <PlayerRow
              key={e.playerId}
              entry={e}
              dimmed={false}
              revealed={revealed.has(e.playerId)}
              onToggle={toggleReveal}
            />
          ))}
          {missedcut.length > 0 && <CutLineSeparator />}
          {missedcut.map((e) => (
            <PlayerRow
              key={e.playerId}
              entry={e}
              dimmed={true}
              revealed={revealed.has(e.playerId)}
              onToggle={toggleReveal}
            />
          ))}
        </tbody>
      </table>
      <p className="mt-3 px-3 pb-3 text-[10px] text-neutral-600">
        Tap a row to reveal scores
      </p>
    </div>
  );
}
