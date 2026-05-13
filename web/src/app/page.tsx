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

export const revalidate = 60;

function sortAscByGameDate<T extends { gameDate: string }>(games: T[]): T[] {
  return [...games].sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
}

export default async function HomePage() {
  let games: GameSummary[] = [];
  try {
    games = sortAscByGameDate(await fetchHomeSeoGames());
  } catch (err) {
    // Render the SEO shell with no games when the upstream feed is
    // unavailable — better than failing the SSR pass and yielding a 500
    // for visitors. Log so a sustained outage isn't silent in operator
    // logs. See docs/audits/error-handling-report.md §I7.
    console.warn("[page/home] upstream games feed unavailable:", err);
    games = [];
  }

  const visibleGames = games.slice(0, 12);

  return (
    <>
      <section className="sr-only">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-neutral-50">Scroll Down MLB</h1>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">
            MLB scoreboard for today&apos;s games and the prior 48 hours, with spoiler-free play-by-play timelines.
          </p>
        </div>
        <SpoilerFreeGameList games={visibleGames} showDates />
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
