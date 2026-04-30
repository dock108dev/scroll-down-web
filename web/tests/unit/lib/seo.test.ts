import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { GameSummary } from "@/lib/types";
import {
  buildSeoMetadata,
  itemListJsonLd,
  slugifyTeamName,
  spoilerSafeGameDescription,
  spoilerSafeGameTitle,
  sportsEventJsonLd,
} from "@/lib/seo";

const sampleGame: GameSummary = {
  id: 123,
  leagueCode: "MLB",
  gameDate: "2026-04-30T23:40:00Z",
  homeTeam: "Minnesota Twins",
  awayTeam: "Toronto Blue Jays",
  status: "final",
  score: { home: 8, away: 2 },
  homeScore: 8,
  awayScore: 2,
};

describe("seo helpers", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://scrolldownsports.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds route-specific metadata with canonical and social URLs", () => {
    const metadata = buildSeoMetadata({
      title: "FairBet - Sports Betting Odds Comparison",
      description: "Compare odds without losing the plot.",
      path: "/fairbet",
    });

    expect(metadata.title).toBe("FairBet - Sports Betting Odds Comparison");
    expect(metadata.alternates).toEqual({ canonical: "/fairbet" });
    expect(metadata.openGraph).toMatchObject({
      title: "FairBet - Sports Betting Odds Comparison",
      url: "https://scrolldownsports.com/fairbet",
    });
  });

  it("creates stable team slugs", () => {
    expect(slugifyTeamName("Toronto Blue Jays")).toBe("toronto-blue-jays");
    expect(slugifyTeamName("St. John's Red Storm")).toBe("st-john-s-red-storm");
    expect(slugifyTeamName("A&M Aggies")).toBe("a-and-m-aggies");
  });

  it("keeps spoiler-safe game copy free of scores and winners", () => {
    const title = spoilerSafeGameTitle(sampleGame);
    const description = spoilerSafeGameDescription(sampleGame);

    expect(title).toContain("Toronto Blue Jays at Minnesota Twins");
    expect(description).toContain("without score spoilers");
    expect(`${title} ${description}`).not.toContain("8 - 2");
    expect(`${title} ${description}`).not.toContain("8-2");
    expect(`${title} ${description}`).not.toContain("2 - 8");
    expect(`${title} ${description}`).not.toContain("2-8");
    expect(`${title} ${description}`).not.toMatch(/\b(win|won|lost|beat)\b/i);
  });

  it("omits score fields from JSON-LD", () => {
    const eventJson = JSON.stringify(sportsEventJsonLd(sampleGame));
    const listJson = JSON.stringify(itemListJsonLd([sampleGame], "/games/2026-04-30"));

    expect(eventJson).toContain("SportsEvent");
    expect(eventJson).not.toContain("homeScore");
    expect(eventJson).not.toContain("awayScore");
    expect(eventJson).not.toContain('"score"');
    expect(eventJson).not.toContain("8");
    expect(listJson).not.toContain("8");
  });
});
