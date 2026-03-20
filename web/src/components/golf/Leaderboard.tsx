"use client";

import type { GolfLeaderboardEntry } from "@/lib/golf-types";
import { LeaderboardRow } from "./LeaderboardRow";

export function Leaderboard({
  entries,
  showRounds = true,
}: {
  entries: GolfLeaderboardEntry[];
  showRounds?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-neutral-500">
        No leaderboard data available yet.
      </p>
    );
  }

  return (
    <div data-testid="leaderboard" className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left">
        <thead>
          <tr className="border-b border-neutral-700 text-[11px] uppercase tracking-wider text-neutral-500">
            <th className="py-2 pl-3 pr-2 font-medium">Pos</th>
            <th className="py-2 pr-3 font-medium">Player</th>
            <th className="py-2 px-2 text-center font-medium">Total</th>
            <th className="py-2 px-2 text-center font-medium">Today</th>
            <th className="py-2 px-2 text-center font-medium">Thru</th>
            {showRounds && (
              <>
                <th className="hidden sm:table-cell py-2 px-1.5 text-center font-medium">R1</th>
                <th className="hidden sm:table-cell py-2 px-1.5 text-center font-medium">R2</th>
                <th className="hidden md:table-cell py-2 px-1.5 text-center font-medium">R3</th>
                <th className="hidden md:table-cell py-2 px-1.5 text-center font-medium">R4</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <LeaderboardRow
              key={entry.dg_id}
              entry={entry}
              showRounds={showRounds}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
