import type { MetadataRoute } from "next";
import { getSiteUrl, isNoIndexSite } from "@/lib/site-config";
import { fetchHomeSeoGames } from "@/lib/seo-data";
import { gamePath } from "@/lib/seo";

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
    sitemapEntry(siteUrl, "/settings", now, "yearly", 0.3),
    sitemapEntry(siteUrl, "/privacy", now, "yearly", 0.2),
    sitemapEntry(siteUrl, "/terms", now, "yearly", 0.2),
    sitemapEntry(siteUrl, "/contact", now, "yearly", 0.2),
  ];

  try {
    const games = await fetchHomeSeoGames();
    const seenIds = new Set<number>();
    for (const game of games) {
      if (seenIds.has(game.id)) continue;
      seenIds.add(game.id);
      const lastModified = new Date(game.gameDate);
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
  } catch {
    // Keep the sitemap valid even when the upstream feed is unavailable.
  }

  return entries;
}
