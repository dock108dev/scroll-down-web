import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpoilerFreeGameList } from "@/components/seo/SpoilerFreeGameList";
import { fetchSeoGamesForDate } from "@/lib/seo-data";
import type { GameSummary } from "@/lib/types";
import {
  breadcrumbJsonLd,
  buildSeoMetadata,
  formatLongDate,
  isValidDateParam,
  itemListJsonLd,
  jsonLdScript,
} from "@/lib/seo";

export const revalidate = 60;

function sortGames<T extends { gameDate: string; leagueCode: string }>(games: T[]): T[] {
  return [...games].sort((a, b) => {
    const league = a.leagueCode.localeCompare(b.leagueCode);
    if (league !== 0) return league;
    return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDateParam(date)) {
    return buildSeoMetadata({
      title: "Games - Scroll Down Sports",
      description: "Find spoiler-free sports game trackers on Scroll Down Sports.",
      path: `/games/${date}`,
      noIndex: true,
    });
  }

  const formatted = formatLongDate(date);
  return buildSeoMetadata({
    title: `${formatted} Games - Spoiler-Free Sports Tracker`,
    description: `Browse MLB, NBA, NHL, and NCAAB games for ${formatted} without score spoilers. Open each matchup when you are ready to catch up.`,
    path: `/games/${date}`,
  });
}

export default async function GamesByDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidDateParam(date)) notFound();

  let games: GameSummary[] = [];
  try {
    games = sortGames(await fetchSeoGamesForDate(date));
  } catch {
    games = [];
  }

  const formatted = formatLongDate(date);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Spoiler-free schedule</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-50">{formatted} Games</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
          Catch up on each matchup without seeing the score first. Game pages keep outcomes hidden until you choose to reveal them.
        </p>
      </div>

      <SpoilerFreeGameList games={games} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: "Games", path: "/" },
            { name: formatted, path: `/games/${date}` },
          ]),
        )}
      />
      {games.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(itemListJsonLd(games, `/games/${date}`))}
        />
      )}
    </main>
  );
}
