"use client";

import { useMemo, useState } from "react";
import { useGamesList } from "@/hooks/useGamesList";
import { useOnboarding } from "@/stores/onboarding";
import { useCatchupProgress } from "@/stores/catchup-progress";
import { GameRow } from "@/components/home/GameRow";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { isFinal, isLive, isPregame } from "@/lib/types";
import type { GameSummary } from "@/lib/types";
import { findMlbTeam } from "@/lib/mlb-teams";

interface HeroPick {
  game: GameSummary;
  reason: "favorite" | "fallback";
}

function pickHero(games: GameSummary[], favoriteAbbr: string | null, now: number): HeroPick | null {
  if (favoriteAbbr) {
    // Favorite team's game: prefer live, then most-recent final, then upcoming.
    const favGames = games.filter(
      (g) => g.homeTeamAbbr === favoriteAbbr || g.awayTeamAbbr === favoriteAbbr,
    );
    const favLive = favGames.find((g) => isLive(g.status, g));
    if (favLive) return { game: favLive, reason: "favorite" };
    const favFinal = favGames
      .filter((g) => isFinal(g.status, g))
      .sort((a, b) => Date.parse(b.gameDate) - Date.parse(a.gameDate))[0];
    if (favFinal) return { game: favFinal, reason: "favorite" };
    const favUpcoming = favGames
      .filter((g) => isPregame(g.status, g) && Date.parse(g.gameDate) >= now)
      .sort((a, b) => Date.parse(a.gameDate) - Date.parse(b.gameDate))[0];
    if (favUpcoming) return { game: favUpcoming, reason: "favorite" };
  }
  // No favorite, or favorite has no relevant game in window: fall back to the
  // most recent live game; if none, the most recent final.
  const live = games.filter((g) => isLive(g.status, g));
  if (live.length > 0) {
    const pick = live.sort((a, b) => Date.parse(b.gameDate) - Date.parse(a.gameDate))[0];
    return { game: pick, reason: "fallback" };
  }
  const finals = games
    .filter((g) => isFinal(g.status, g))
    .sort((a, b) => Date.parse(b.gameDate) - Date.parse(a.gameDate));
  if (finals.length > 0) return { game: finals[0], reason: "fallback" };
  return null;
}

export default function HomePageClient() {
  const { games, loading, error, refetch } = useGamesList();
  const favoriteTeam = useOnboarding((s) => s.favoriteTeam);
  const completedEntries = useCatchupProgress((s) => s.entries);

  // Capture "now" once per mount so the hero pick stays deterministic across
  // re-renders. Stale by at most one mount cycle, which is fine for hero
  // ranking — the data refetch on visibility change is what surfaces new live
  // games, not this clock.
  const [nowAtMount] = useState(() => Date.now());
  const hero = useMemo(() => pickHero(games, favoriteTeam, nowAtMount), [games, favoriteTeam, nowAtMount]);

  const otherGames = useMemo(() => {
    const heroId = hero?.game.id;
    return games
      .filter((g) => g.id !== heroId)
      .filter((g) => isLive(g.status, g) || isFinal(g.status, g) || isPregame(g.status, g))
      .sort((a, b) => Date.parse(b.gameDate) - Date.parse(a.gameDate));
  }, [games, hero]);

  if (loading && games.length === 0) {
    return (
      <div className="home-deck-page">
        <div data-testid="page-home" className="home-deck mx-auto max-w-2xl px-4 py-6 space-y-4">
          <LoadingSkeleton className="h-48" />
          <LoadingSkeleton className="h-20" count={4} />
        </div>
      </div>
    );
  }

  if (error && games.length === 0) {
    return (
      <div className="home-deck-page">
        <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-4">
          <p className="text-sm text-[rgba(245,239,220,0.65)]">We couldn&rsquo;t load today&rsquo;s games.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-[rgba(245,239,220,0.18)] bg-[#0b110d] px-4 py-2 text-sm font-medium text-[#f5efdc] hover:bg-[#122019] min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="home-deck-page">
        <div data-testid="page-home" className="home-deck mx-auto max-w-2xl px-4 py-16 text-center space-y-3">
          <h1 className="text-lg font-semibold text-[#f5efdc]">No games in the last 48 hours.</h1>
          <p className="text-sm text-[rgba(245,239,220,0.65)] max-w-sm mx-auto leading-relaxed">
            Check back when MLB is on the schedule. During the All-Star break and off-season this view stays empty.
          </p>
        </div>
      </div>
    );
  }

  const favTeam = favoriteTeam ? findMlbTeam(favoriteTeam) : null;

  return (
    <div className="home-deck-page">
      <div data-testid="page-home" className="home-deck mx-auto max-w-2xl px-4 pt-4 pb-10">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-[#f5efdc] tracking-tight">
            {favTeam ? `${favTeam.name} catch-up` : "Catch up — spoiler-free"}
          </h1>
          <p className="mt-1 text-sm text-[rgba(245,239,220,0.65)] leading-snug">
            {favTeam
              ? `Start with the ${favTeam.name}, or pick another game below. Scores stay hidden until you reveal.`
              : "MLB games from the last 48 hours. Tap one and walk through the key plays — no scores until the reveal."}
          </p>
        </header>

        {hero && (
          <section aria-label="Hero game" className="mb-6">
            {hero.reason === "fallback" && favTeam && (
              <p className="mb-2 text-xs text-[rgba(245,239,220,0.55)]">
                {favTeam.name} aren&rsquo;t playing — here&rsquo;s a recent game instead.
              </p>
            )}
            <GameRow
              game={hero.game}
              featured
              completed={Boolean(completedEntries[hero.game.id]?.completed)}
              inProgress={Boolean(
                completedEntries[hero.game.id] && !completedEntries[hero.game.id].completed,
              )}
            />
          </section>
        )}

        {otherGames.length > 0 && (
          <section aria-label="Other games" className="space-y-2">
            <h2 className="catchup-eyebrow mb-2">
              Recent reconstructions
            </h2>
            {otherGames.map((g) => (
              <GameRow
                key={g.id}
                game={g}
                completed={Boolean(completedEntries[g.id]?.completed)}
                inProgress={Boolean(
                  completedEntries[g.id] && !completedEntries[g.id].completed,
                )}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
