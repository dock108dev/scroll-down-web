import type { MetadataRoute } from "next";
import { getSiteUrl, isNoIndexSite } from "@/lib/site-config";
import { fetchRollingSeoGames } from "@/lib/seo-data";
import {
  gamePath,
  rollingSeoDates,
  slugifyTeamName,
  SUPPORTED_SEO_LEAGUES,
} from "@/lib/seo";

function sitemapEntry(
  siteUrl: string,
  path: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isNoIndexSite()) return [];
  const siteUrl = getSiteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    sitemapEntry(siteUrl, "/", now, "hourly", 1.0),
    sitemapEntry(siteUrl, "/fairbet", now, "hourly", 0.8),
    sitemapEntry(siteUrl, "/analytics", now, "weekly", 0.7),
    sitemapEntry(siteUrl, "/analytics/nba", now, "weekly", 0.6),
    sitemapEntry(siteUrl, "/analytics/nhl", now, "weekly", 0.6),
    sitemapEntry(siteUrl, "/analytics/ncaab", now, "weekly", 0.6),
    sitemapEntry(siteUrl, "/analytics/simulator", now, "weekly", 0.6),
    sitemapEntry(siteUrl, "/privacy", now, "yearly", 0.2),
    sitemapEntry(siteUrl, "/terms", now, "yearly", 0.2),
    sitemapEntry(siteUrl, "/contact", now, "yearly", 0.2),
  ];

  if (process.env.GOLF_ENABLED === "true") {
    entries.push(sitemapEntry(siteUrl, "/golf", now, "daily", 0.8));
  }

  for (const league of SUPPORTED_SEO_LEAGUES) {
    entries.push(sitemapEntry(siteUrl, `/sports/${league}`, now, "hourly", 0.75));
  }

  for (const date of rollingSeoDates()) {
    entries.push(sitemapEntry(siteUrl, `/games/${date}`, now, "daily", 0.72));
  }

  try {
    const games = await fetchRollingSeoGames();
    const seenGameIds = new Set<number>();
    const seenTeams = new Set<string>();
    for (const game of games) {
      if (!seenGameIds.has(game.id)) {
        seenGameIds.add(game.id);
        const lastModified = new Date(
          game.lastIngestedAt ?? game.lastScrapedAt ?? game.gameDate,
        );
        entries.push(
          sitemapEntry(
            siteUrl,
            gamePath(game),
            Number.isNaN(lastModified.getTime()) ? now : lastModified,
            "hourly",
            0.7,
          ),
        );
      }
      seenTeams.add(slugifyTeamName(game.awayTeam));
      seenTeams.add(slugifyTeamName(game.homeTeam));
    }

    for (const teamSlug of Array.from(seenTeams).filter(Boolean).sort()) {
      entries.push(sitemapEntry(siteUrl, `/teams/${teamSlug}`, now, "daily", 0.62));
    }
  } catch {
    // Keep the sitemap valid even when the upstream sports feed is unavailable.
  }

  return entries;
}
