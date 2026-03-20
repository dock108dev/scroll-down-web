"use client";

import { useGolfTournaments } from "@/hooks/useGolfTournaments";
import { TournamentCard } from "@/components/golf/TournamentCard";
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
  const { sections, loading, error } = useGolfTournaments();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold text-neutral-50">PGA Tour</h1>

      {loading && (
        <p className="py-12 text-center text-sm text-neutral-500">
          Loading tournaments…
        </p>
      )}

      {error && (
        <p className="py-12 text-center text-sm text-red-400">{error}</p>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          <Section title="This Week" tournaments={sections.thisWeek} />
          <Section title="Upcoming" tournaments={sections.upcoming} />
          <Section title="Recent Results" tournaments={sections.recent} />

          {sections.thisWeek.length === 0 &&
            sections.upcoming.length === 0 &&
            sections.recent.length === 0 && (
              <p className="py-12 text-center text-sm text-neutral-500">
                No tournaments available right now.
              </p>
            )}
        </div>
      )}
    </main>
  );
}
