import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpoilerFreeGameList } from "@/components/seo/SpoilerFreeGameList";
import { fetchRollingSeoGames } from "@/lib/seo-data";
import type { GameSummary } from "@/lib/types";
import {
  breadcrumbJsonLd,
  buildSeoMetadata,
  itemListJsonLd,
  jsonLdScript,
  leagueLabel,
  normalizeLeague,
} from "@/lib/seo";

export const revalidate = 60;

function sortGames<T extends { gameDate: string }>(games: T[]): T[] {
  return [...games].sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ league: string }>;
}): Promise<Metadata> {
  const { league: rawLeague } = await params;
  const league = normalizeLeague(rawLeague);
  if (!league) {
    return buildSeoMetadata({
      title: "Sports - Scroll Down Sports",
      description: "Find spoiler-free sports game trackers on Scroll Down Sports.",
      path: `/sports/${rawLeague}`,
      noIndex: true,
    });
  }

  const label = leagueLabel(league);
  return buildSeoMetadata({
    title: `${label} Games - Spoiler-Free Schedule & Catch-Up`,
    description: `Browse recent and upcoming ${label} games without score spoilers. Open each matchup for a spoiler-free timeline and game tracker.`,
    path: `/sports/${league}`,
  });
}

export default async function SportPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: rawLeague } = await params;
  const league = normalizeLeague(rawLeague);
  if (!league) notFound();

  let games: GameSummary[] = [];
  try {
    games = sortGames(
      (await fetchRollingSeoGames()).filter(
        (game) => game.leagueCode.toLowerCase() === league,
      ),
    );
  } catch {
    games = [];
  }

  const label = leagueLabel(league);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Spoiler-free sports hub</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-50">{label} Games</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
          Follow recent, live, and upcoming {label} matchups without seeing scores before you are ready.
        </p>
      </div>

      <SpoilerFreeGameList games={games} showDates />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: "Sports", path: "/" },
            { name: label, path: `/sports/${league}` },
          ]),
        )}
      />
      {games.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(itemListJsonLd(games, `/sports/${league}`))}
        />
      )}
    </main>
  );
}
