import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSummary } from "@/lib/types";

const games: GameSummary[] = [
  {
    id: 190064,
    leagueCode: "MLB",
    gameDate: "2026-04-30T23:40:00Z",
    homeTeam: "Minnesota Twins",
    awayTeam: "Toronto Blue Jays",
    status: "live",
    score: { home: 0, away: 0 },
    lastIngestedAt: "2026-04-30T21:32:15.850967Z",
  },
  {
    id: 190054,
    leagueCode: "NHL",
    gameDate: "2026-04-30T23:30:00Z",
    homeTeam: "Minnesota Wild",
    awayTeam: "Dallas Stars",
    status: "pregame",
  },
];

describe("sitemap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("PUBLIC_BASE_URL", "https://scrolldownsports.com");
    vi.stubEnv("SITE_NOINDEX", "false");
    vi.stubEnv("GOLF_ENABLED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/seo-data");
  });

  it("includes dynamic game, date, sport, and team pages while excluding disabled golf", async () => {
    vi.doMock("@/lib/seo-data", () => ({
      fetchRollingSeoGames: vi.fn().mockResolvedValue(games),
    }));

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://scrolldownsports.com");
    expect(urls).toContain("https://scrolldownsports.com/sports/mlb");
    expect(urls).toContain("https://scrolldownsports.com/game/190064");
    expect(urls).toContain("https://scrolldownsports.com/teams/toronto-blue-jays");
    expect(urls).toContain("https://scrolldownsports.com/teams/minnesota-wild");
    expect(urls.some((url) => url.endsWith("/golf"))).toBe(false);
    expect(urls.some((url) => /\/games\/\d{4}-\d{2}-\d{2}$/.test(url))).toBe(true);
  });

  it("keeps stable URLs when the sports feed is unavailable", async () => {
    vi.doMock("@/lib/seo-data", () => ({
      fetchRollingSeoGames: vi.fn().mockRejectedValue(new Error("upstream unavailable")),
    }));

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://scrolldownsports.com");
    expect(urls).toContain("https://scrolldownsports.com/fairbet");
    expect(urls).toContain("https://scrolldownsports.com/sports/nhl");
    expect(urls.some((url) => url.includes("/game/"))).toBe(false);
  });
});
