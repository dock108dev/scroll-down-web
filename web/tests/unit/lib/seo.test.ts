import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildSeoMetadata,
  formatLongDate,
  formatGameTime,
  gamePath,
  spoilerSafeGameTitle,
  spoilerSafeGameDescription,
  organizationJsonLd,
  websiteJsonLd,
  sportsEventJsonLd,
  itemListJsonLd,
  jsonLdScript,
} from "@/lib/seo";
import type { GameSummary } from "@/lib/types";

const SITE = "https://example.test";

beforeEach(() => {
  vi.stubEnv("PUBLIC_BASE_URL", SITE);
  vi.stubEnv("SITE_URL", "");
  vi.stubEnv("SITE_NOINDEX", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeGame(overrides: Partial<GameSummary> = {}): GameSummary {
  return {
    id: 12345,
    awayTeam: "NYY",
    homeTeam: "BOS",
    gameDate: "2026-04-15T23:05:00Z",
    localGameDate: "2026-04-15",
    ...overrides,
  } as GameSummary;
}

describe("buildSeoMetadata", () => {
  it("builds canonical/openGraph/twitter from minimal input", () => {
    const md = buildSeoMetadata({
      title: "T",
      description: "D",
      path: "/foo",
    });
    expect(md.title).toBe("T");
    expect(md.description).toBe("D");
    expect(md.alternates?.canonical).toBe("/foo");
    expect(md.robots).toMatchObject({ index: true, follow: true });
    const og = md.openGraph as { type?: string; url?: string; images?: Array<{ url: string }> } | undefined;
    expect(og?.type).toBe("website");
    expect(og?.url).toBe(`${SITE}/foo`);
    expect(og?.images?.[0]?.url).toBe(`${SITE}/app-icon.png`);
    const twitter = md.twitter as { card?: string } | undefined;
    expect(twitter?.card).toBe("summary_large_image");
  });

  it("respects noIndex and absolute image overrides", () => {
    const md = buildSeoMetadata({
      title: "T",
      description: "D",
      path: "no-leading-slash",
      type: "article",
      image: "https://cdn.example/x.png",
      noIndex: true,
    });
    expect(md.robots).toMatchObject({ index: false, follow: false });
    const og = md.openGraph as { type?: string; url?: string; images?: Array<{ url: string }> } | undefined;
    expect(og?.type).toBe("article");
    expect(og?.url).toBe(`${SITE}/no-leading-slash`);
    expect(og?.images?.[0]?.url).toBe("https://cdn.example/x.png");
  });
});

describe("date / game formatters", () => {
  it("formatLongDate renders weekday + month + day + year in Eastern", () => {
    expect(formatLongDate("2026-04-15")).toBe("Wednesday, April 15, 2026");
  });

  it("formatGameTime renders Eastern wall-clock time with am/pm marker", () => {
    // 23:05 UTC on 2026-04-15 = 19:05 ET (EDT)
    expect(formatGameTime("2026-04-15T23:05:00Z")).toMatch(/7:05/);
  });

  it("gamePath builds /catchup/<id>", () => {
    expect(gamePath({ id: 99 })).toBe("/catchup/99");
  });

  it("spoiler-safe title / description never reveal scores", () => {
    const game = makeGame();
    const title = spoilerSafeGameTitle(game);
    expect(title).toBe("NYY at BOS - MLB spoiler-free game tracker");
    const desc = spoilerSafeGameDescription(game);
    expect(desc).toContain("NYY at BOS");
    expect(desc).toContain("April 15, 2026");
    expect(desc).not.toMatch(/\d+-\d+/);
  });
});

describe("JSON-LD builders", () => {
  it("organizationJsonLd carries site URL + logo", () => {
    const data = organizationJsonLd();
    expect(data["@type"]).toBe("Organization");
    expect(data.url).toBe(SITE);
    expect(data.logo).toBe(`${SITE}/app-icon.png`);
  });

  it("websiteJsonLd uses the resolved site URL", () => {
    expect(websiteJsonLd().url).toBe(SITE);
  });

  it("sportsEventJsonLd lists both competitors and links to the catchup page", () => {
    const data = sportsEventJsonLd(makeGame({ id: 7 }));
    expect(data["@type"]).toBe("SportsEvent");
    expect(data.url).toBe(`${SITE}/catchup/7`);
    expect(data.competitor.map((c) => c.name)).toEqual(["NYY", "BOS"]);
  });

  it("itemListJsonLd indexes positions starting at 1", () => {
    const list = itemListJsonLd(
      [makeGame({ id: 1 }), makeGame({ id: 2 })],
      "/recent",
    );
    expect(list.numberOfItems).toBe(2);
    expect(list.url).toBe(`${SITE}/recent`);
    expect(list.itemListElement[0].position).toBe(1);
    expect(list.itemListElement[1].position).toBe(2);
    expect(list.itemListElement[0].url).toBe(`${SITE}/catchup/1`);
  });
});

describe("jsonLdScript", () => {
  it("escapes < to prevent script-tag injection", () => {
    const html = jsonLdScript({ x: "</script>" }).__html;
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c/script>");
  });
});
