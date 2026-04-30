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
  slugifyTeamName,
} from "@/lib/seo";

export const revalidate = 60;

function sortGames<T extends { gameDate: string }>(games: T[]): T[] {
  return [...games].sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
}

function gamesForTeam(games: GameSummary[], teamSlug: string): { teamName: string; games: GameSummary[] } | null {
  let teamName = "";
  const matches = games.filter((game) => {
    const awayMatch = slugifyTeamName(game.awayTeam) === teamSlug;
    const homeMatch = slugifyTeamName(game.homeTeam) === teamSlug;
    if (awayMatch) teamName = game.awayTeam;
    if (homeMatch) teamName = game.homeTeam;
    return awayMatch || homeMatch;
  });
  if (!teamName || matches.length === 0) return null;
  return { teamName, games: sortGames(matches) };
}

async function getTeamPageData(teamSlug: string): Promise<{ teamName: string; games: GameSummary[] } | null> {
  if (!/^[a-z0-9-]{2,80}$/.test(teamSlug)) return null;
  const games = await fetchRollingSeoGames();
  return gamesForTeam(games, teamSlug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}): Promise<Metadata> {
  const { teamSlug } = await params;
  let data: { teamName: string; games: GameSummary[] } | null = null;
  try {
    data = await getTeamPageData(teamSlug);
  } catch {
    data = null;
  }

  if (!data) {
    return buildSeoMetadata({
      title: "Team Games - Scroll Down Sports",
      description: "Find spoiler-free team game trackers on Scroll Down Sports.",
      path: `/teams/${teamSlug}`,
      noIndex: true,
    });
  }

  return buildSeoMetadata({
    title: `${data.teamName} Games - Spoiler-Free Schedule & Catch-Up`,
    description: `Browse recent and upcoming ${data.teamName} games without score spoilers. Open each matchup for a spoiler-free timeline and game tracker.`,
    path: `/teams/${teamSlug}`,
  });
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  let data: { teamName: string; games: GameSummary[] } | null = null;
  try {
    data = await getTeamPageData(teamSlug);
  } catch {
    data = null;
  }
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Spoiler-free team hub</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-50">{data.teamName} Games</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
          Track recent, live, and upcoming {data.teamName} games without revealing scores before you choose.
        </p>
      </div>

      <SpoilerFreeGameList games={data.games} showDates />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: "Teams", path: "/" },
            { name: data.teamName, path: `/teams/${teamSlug}` },
          ]),
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(itemListJsonLd(data.games, `/teams/${teamSlug}`))}
      />
    </main>
  );
}
