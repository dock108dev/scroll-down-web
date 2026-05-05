import type { Metadata } from "next";
import type { GameSummary } from "@/lib/types";
import {
  addDaysCalendar,
  easternCalendarToday,
  gameScheduleDateStr,
  APP_TIMEZONE,
} from "@/lib/date-utils";
import { getSiteUrl } from "@/lib/site-config";

export const SUPPORTED_SEO_LEAGUES = ["mlb", "nba", "nhl", "ncaab"] as const;
export type SeoLeague = (typeof SUPPORTED_SEO_LEAGUES)[number];

export const LEAGUE_LABELS: Record<SeoLeague, string> = {
  mlb: "MLB",
  nba: "NBA",
  nhl: "NHL",
  ncaab: "NCAAB",
};

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
      siteName: "Scroll Down Sports",
      title,
      description,
      url,
      images: [{ url: imageUrl, width: 1024, height: 1024, alt: "Scroll Down Sports" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function normalizeLeague(value: string): SeoLeague | null {
  const key = value.trim().toLowerCase();
  return SUPPORTED_SEO_LEAGUES.includes(key as SeoLeague) ? (key as SeoLeague) : null;
}

export function leagueLabel(value: string): string {
  const league = normalizeLeague(value);
  return league ? LEAGUE_LABELS[league] : value.toUpperCase();
}

export function slugifyTeamName(team: string): string {
  return team
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidDateParam(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return value === date.toISOString().slice(0, 10);
}

export function rollingSeoDates(pastDays = 14, futureDays = 7): string[] {
  const today = easternCalendarToday();
  const dates: string[] = [];
  for (let offset = -pastDays; offset <= futureDays; offset++) {
    dates.push(addDaysCalendar(today, offset));
  }
  return dates;
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
  return `/game/${game.id}`;
}

export function spoilerSafeGameTitle(game: Pick<GameSummary, "awayTeam" | "homeTeam" | "leagueCode">): string {
  return `${game.awayTeam} at ${game.homeTeam} - ${leagueLabel(game.leagueCode)} spoiler-free game tracker`;
}

export function spoilerSafeGameDescription(
  game: Pick<GameSummary, "awayTeam" | "homeTeam" | "leagueCode" | "gameDate" | "localGameDate">,
): string {
  const date = formatLongDate(gameScheduleDateStr(game));
  return `Catch up on ${game.awayTeam} at ${game.homeTeam} from ${date} without score spoilers. Follow the ${leagueLabel(game.leagueCode)} timeline, status, and matchup details when you are ready.`;
}

export function organizationJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Scroll Down Sports",
    url: siteUrl,
    logo: absoluteUrl("/app-icon.png"),
  };
}

export function websiteJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Scroll Down Sports",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
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

export function sportsEventJsonLd(game: GameSummary) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${game.awayTeam} at ${game.homeTeam}`,
    url: absoluteUrl(gamePath(game)),
    startDate: game.gameDate,
    eventStatus: "https://schema.org/EventScheduled",
    sport: leagueLabel(game.leagueCode),
    competitor: [
      {
        "@type": "SportsTeam",
        name: game.awayTeam,
      },
      {
        "@type": "SportsTeam",
        name: game.homeTeam,
      },
    ],
  };
}

export function jsonLdScript(data: unknown) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}
