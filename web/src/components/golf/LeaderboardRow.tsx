"use client";

import type { GolfLeaderboardEntry } from "@/lib/golf-types";
import { cn } from "@/lib/utils";

function formatScore(score: number | null) {
  if (score === null) return "–";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreColor(score: number | null) {
  if (score === null) return "text-neutral-500";
  if (score < 0) return "text-red-400";
  if (score > 0) return "text-blue-400";
  return "text-neutral-300";
}

export function LeaderboardRow({ entry, showRounds }: { entry: GolfLeaderboardEntry; showRounds: boolean }) {
  const isCut = entry.status === "CUT" || entry.status === "WD" || entry.status === "DQ";

  return (
    <tr className={cn("border-b border-neutral-800/50", isCut && "opacity-50")}>
      <td className="whitespace-nowrap py-2 pl-3 pr-2 text-xs font-medium text-neutral-400">
        {entry.position}
      </td>
      <td className="py-2 pr-3 text-sm text-neutral-50">
        {entry.player_name}
      </td>
      <td className={cn("whitespace-nowrap py-2 px-2 text-center text-sm font-semibold", scoreColor(entry.total_score))}>
        {formatScore(entry.total_score)}
      </td>
      <td className={cn("whitespace-nowrap py-2 px-2 text-center text-xs", scoreColor(entry.today_score))}>
        {formatScore(entry.today_score)}
      </td>
      <td className="whitespace-nowrap py-2 px-2 text-center text-xs text-neutral-400">
        {entry.thru || "–"}
      </td>
      {showRounds && (
        <>
          <td className="hidden sm:table-cell whitespace-nowrap py-2 px-1.5 text-center text-xs text-neutral-500">
            {entry.r1 ?? "–"}
          </td>
          <td className="hidden sm:table-cell whitespace-nowrap py-2 px-1.5 text-center text-xs text-neutral-500">
            {entry.r2 ?? "–"}
          </td>
          <td className="hidden md:table-cell whitespace-nowrap py-2 px-1.5 text-center text-xs text-neutral-500">
            {entry.r3 ?? "–"}
          </td>
          <td className="hidden md:table-cell whitespace-nowrap py-2 px-1.5 text-center text-xs text-neutral-500">
            {entry.r4 ?? "–"}
          </td>
        </>
      )}
    </tr>
  );
}
