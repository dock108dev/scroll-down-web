import type { Metadata } from "next";
import type { GameSummary } from "@/lib/types";
import {
  gameScheduleDateStr,
  APP_TIMEZONE,
} from "@/lib/date-utils";
import { getSiteUrl } from "@/lib/site-config";

export interface SeoPageInput {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  noIndex?: boolean;
}

function absoluteUrl(path: string): string {
  const siteUrl = getSiteUrl();
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildSeoMetadata({
  title,
  description,
  path,
  type = "website",
  image = "/app-icon.png",
  noIndex = false,
}: SeoPageInput): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: {
      index: !noIndex,
      follow: !noIndex,
    },
    openGraph: {
      type,
      siteName: "Scroll Down MLB",
      title,
      description,
      url,
      images: [{ url: imageUrl, width: 1024, height: 1024, alt: "Scroll Down MLB" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function formatLongDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  });
}

export function formatGameTime(gameDate: string): string {
  return new Date(gameDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}

export function gamePath(game: Pick<GameSummary, "id">): string {
  return `/catchup/${game.id}`;
}

export function spoilerSafeGameTitle(game: Pick<GameSummary, "awayTeam" | "homeTeam">): string {
  return `${game.awayTeam} at ${game.homeTeam} - MLB spoiler-free game tracker`;
}

export function spoilerSafeGameDescription(
  game: Pick<GameSummary, "awayTeam" | "homeTeam" | "gameDate" | "localGameDate">,
): string {
  const date = formatLongDate(gameScheduleDateStr(game));
  return `Catch up on ${game.awayTeam} at ${game.homeTeam} from ${date} without score spoilers. Follow the MLB play-by-play timeline when you're ready.`;
}

export function organizationJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Scroll Down MLB",
    url: siteUrl,
    logo: absoluteUrl("/app-icon.png"),
  };
}

export function websiteJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Scroll Down MLB",
    url: siteUrl,
  };
}

export function sportsEventJsonLd(game: Pick<GameSummary, "id" | "awayTeam" | "homeTeam" | "gameDate">) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${game.awayTeam} at ${game.homeTeam}`,
    url: absoluteUrl(gamePath(game)),
    startDate: game.gameDate,
    eventStatus: "https://schema.org/EventScheduled",
    sport: "MLB",
    competitor: [
      { "@type": "SportsTeam", name: game.awayTeam },
      { "@type": "SportsTeam", name: game.homeTeam },
    ],
  };
}

export function itemListJsonLd(games: GameSummary[], path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: absoluteUrl(path),
    numberOfItems: games.length,
    itemListElement: games.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(gamePath(game)),
      name: spoilerSafeGameTitle(game),
    })),
  };
}

export function jsonLdScript(data: unknown) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}
