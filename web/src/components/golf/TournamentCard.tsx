"use client";

import Link from "next/link";
import type { GolfTournament } from "@/lib/golf-types";
import { cn } from "@/lib/utils";

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

function formatPurse(purse: number) {
  if (purse >= 1_000_000) return `$${(purse / 1_000_000).toFixed(1)}M`;
  if (purse >= 1_000) return `$${(purse / 1_000).toFixed(0)}K`;
  return `$${purse}`;
}

const STATUS_STYLES: Record<GolfTournament["status"], string> = {
  in_progress: "bg-green-600/20 text-green-400",
  upcoming: "bg-blue-600/20 text-blue-400",
  completed: "bg-neutral-700/50 text-neutral-400",
};

const STATUS_LABELS: Record<GolfTournament["status"], string> = {
  in_progress: "Live",
  upcoming: "Upcoming",
  completed: "Final",
};

export function TournamentCard({ tournament }: { tournament: GolfTournament }) {
  return (
    <Link
      href={`/golf/${tournament.event_id}`}
      className="block rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-neutral-700 hover:bg-neutral-900/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-neutral-50">
            {tournament.event_name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-neutral-400">
            {tournament.course}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            STATUS_STYLES[tournament.status],
          )}
        >
          {STATUS_LABELS[tournament.status]}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500">
        <span>{formatDateRange(tournament.start_date, tournament.end_date)}</span>
        {tournament.purse > 0 && (
          <>
            <span className="text-neutral-700">·</span>
            <span>{formatPurse(tournament.purse)}</span>
          </>
        )}
        {tournament.current_round && tournament.status === "in_progress" && (
          <>
            <span className="text-neutral-700">·</span>
            <span>Round {tournament.current_round}</span>
          </>
        )}
      </div>
    </Link>
  );
}
