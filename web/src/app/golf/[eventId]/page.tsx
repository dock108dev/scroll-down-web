"use client";

import { use } from "react";
import Link from "next/link";
import { useGolfLeaderboard } from "@/hooks/useGolfLeaderboard";
import { Leaderboard } from "@/components/golf/Leaderboard";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-green-600/20 text-green-400",
  upcoming: "bg-blue-600/20 text-blue-400",
  completed: "bg-neutral-700/50 text-neutral-400",
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: "Live",
  upcoming: "Upcoming",
  completed: "Final",
};

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

export default function GolfEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const { tournament, leaderboard, loading, error } =
    useGolfLeaderboard(eventId);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href="/golf"
        className="mb-4 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        All Tournaments
      </Link>

      {loading && !tournament && (
        <p className="py-12 text-center text-sm text-neutral-500">
          Loading…
        </p>
      )}

      {error && (
        <p className="py-12 text-center text-sm text-red-400">{error}</p>
      )}

      {tournament && (
        <>
          <div className="mb-6">
            <div className="flex items-start gap-3">
              <h1 className="text-xl font-bold text-neutral-50">
                {tournament.event_name}
              </h1>
              <span
                className={cn(
                  "mt-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  STATUS_STYLES[tournament.status] ?? "bg-neutral-700/50 text-neutral-400",
                )}
              >
                {STATUS_LABELS[tournament.status] ?? tournament.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-400">
              {tournament.course}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {formatDateRange(tournament.start_date, tournament.end_date)}
              {tournament.current_round &&
                tournament.status === "in_progress" &&
                ` · Round ${tournament.current_round}`}
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60">
            <Leaderboard entries={leaderboard} />
          </div>
        </>
      )}
    </main>
  );
}
