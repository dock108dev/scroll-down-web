import Link from "next/link";
import HomePageClient from "@/components/home/HomePageClient";
import { SpoilerFreeGameList } from "@/components/seo/SpoilerFreeGameList";
import { fetchHomeSeoGames } from "@/lib/seo-data";
import type { GameSummary } from "@/lib/types";
import {
  itemListJsonLd,
  jsonLdScript,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import { toEasternDateStr } from "@/lib/date-utils";

export const revalidate = 60;

function sortSeoGames<T extends { gameDate: string }>(games: T[]): T[] {
  return [...games].sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
}

export default async function HomePage() {
  let games: GameSummary[] = [];
  try {
    games = sortSeoGames(await fetchHomeSeoGames());
  } catch {
    games = [];
  }

  const today = toEasternDateStr(new Date().toISOString());
  const visibleGames = games.slice(0, 8);

  return (
    <>
      <section className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-neutral-50">Spoiler-free sports catch-up</h1>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">
            Browse today&apos;s MLB, NBA, NHL, and NCAAB games without seeing scores until you choose to reveal them.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/games/${today}`} className="rounded-full border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-neutral-50">
              Today&apos;s games
            </Link>
            <Link href="/sports/mlb" className="rounded-full border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-neutral-50">
              MLB
            </Link>
            <Link href="/sports/nhl" className="rounded-full border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-neutral-50">
              NHL
            </Link>
          </div>
        </div>
        <SpoilerFreeGameList
          games={visibleGames}
          showDates
          includeAds={false}
        />
      </section>

      <HomePageClient />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(organizationJsonLd())}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(websiteJsonLd())}
      />
      {games.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(itemListJsonLd(visibleGames, "/"))}
        />
      )}
    </>
  );
}
