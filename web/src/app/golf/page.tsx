"use client";

import { useAutoRetry } from "@/hooks/useAutoRetry";
import { useGolfTournaments } from "@/hooks/useGolfTournaments";
import { TournamentCard } from "@/components/golf/TournamentCard";
import { Spinner } from "@/components/shared/Spinner";
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
  const { sections, loading, error, refetch } = useGolfTournaments();
  const { retryCount, manualRetry } = useAutoRetry({ error, loading, refetch });

  return (
    <main data-testid="page-golf" className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold text-neutral-50">PGA Tour</h1>

      {loading && (
        <p className="py-12 text-center text-sm text-neutral-500">
          Loading tournaments…
        </p>
      )}

      {error && (
        <div className="py-12 text-center space-y-4">
          <p className="text-sm text-neutral-400">
            {retryCount >= 3
              ? "The service may be temporarily unavailable."
              : "We\u2019re having trouble loading tournament data right now."}
          </p>
          <button
            onClick={manualRetry}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg bg-neutral-800 text-neutral-200 hover:text-neutral-50 border border-neutral-700 transition disabled:opacity-50"
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
    </main>
  );
}
