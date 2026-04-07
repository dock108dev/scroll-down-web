"use client";

import { useAutoRetry } from "@/hooks/useAutoRetry";
import { useGolfTournaments } from "@/hooks/useGolfTournaments";
import { TournamentCard } from "@/components/golf/TournamentCard";
import { Spinner } from "@/components/shared/Spinner";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { StaleBanner } from "@/components/shared/StaleBanner";
import { InlineFeedback } from "@/components/shared/InlineFeedback";
import type { GolfTournament } from "@/lib/golf-types";

function Section({ title, tournaments }: { title: string; tournaments: GolfTournament[] }) {
  if (tournaments.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {tournaments.map((t) => (
          <TournamentCard key={t.event_id} tournament={t} />
        ))}
      </div>
    </section>
  );
}

export default function GolfPage() {
  const { sections, loading, error, stale, staleAt, refetch } = useGolfTournaments();
  const { retryCount, manualRetry } = useAutoRetry({ error, loading, refetch });

  return (
    <main data-testid="page-golf" className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold text-neutral-50">PGA Tour</h1>

      <StaleBanner stale={stale} staleAt={staleAt} onRetry={() => refetch()} />

      {loading && !error && (
        <div className="py-6 space-y-3">
          <LoadingSkeleton variant="list" count={4} />
        </div>
      )}

      {error && !loading && (
        <div className="py-12 text-center space-y-4">
          <p className="text-sm text-neutral-400">
            {retryCount >= 3
              ? "We can\u2019t reach the server right now. It may be temporarily unavailable."
              : "We\u2019re having trouble connecting to load tournament data."}
          </p>
          <button
            onClick={manualRetry}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg bg-neutral-800 dark:bg-neutral-800 text-neutral-200 hover:text-neutral-50 border border-neutral-700 dark:border-neutral-600 transition disabled:opacity-50"
          >
            {loading ? <><Spinner size={14} /> Retrying…</> : "Retry"}
          </button>
          <p className="text-xs text-neutral-600">
            {retryCount >= 3
              ? "Automatic retries exhausted. You can still retry manually."
              : retryCount > 0
                ? "Retrying automatically…"
                : "Check back shortly — tournament data updates regularly."}
          </p>

          {/* Feature explainer when data is unavailable */}
          <div className="mt-6 mx-auto max-w-sm text-left space-y-3 border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
            <p className="text-xs font-medium text-neutral-300">What you&apos;ll find here when data is available:</p>
            <ul className="text-xs text-neutral-500 space-y-1.5 list-none">
              <li className="flex items-start gap-2"><span className="text-green-400 mt-px">&#9679;</span> Live PGA Tour leaderboards updated throughout the round</li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-px">&#9679;</span> This week&apos;s tournament with player scores and standings</li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-px">&#9679;</span> Upcoming tournament schedule and recent results</li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-px">&#9679;</span> Hole-by-hole scoring details for each player</li>
            </ul>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          <Section title="This Week" tournaments={sections.thisWeek} />
          <Section title="Upcoming" tournaments={sections.upcoming} />
          <Section title="Recent Results" tournaments={sections.recent} />

          {sections.thisWeek.length === 0 &&
            sections.upcoming.length === 0 &&
            sections.recent.length === 0 && (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm text-neutral-400">No tournaments available right now</p>
                <p className="text-xs text-neutral-600 leading-relaxed max-w-sm mx-auto">
                  The PGA Tour typically runs Thursday through Sunday. Check back
                  when the next event is underway for live leaderboards and results.
                </p>
              </div>
            )}
        </div>
      )}

      <InlineFeedback context="golf" />
    </main>
  );
}
