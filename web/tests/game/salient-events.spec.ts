/**
 * ISSUE-034: Salient-event extraction pipeline — verified via POST /api/ai/salient-events
 * with mock box scores for NBA, NFL, and MLB.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import type {
  SalientEvent,
  SalientEventType,
  NarrativeType,
  SalientEventResult,
} from "../../src/lib/salient-events";

const ENDPOINT = "/api/ai/salient-events";

// ─── Mock box scores ──────────────────────────────────────

const NBA_BOX = {
  sport: "NBA",
  homeTeam: "Lakers",
  awayTeam: "Celtics",
  homeScore: 112,
  awayScore: 108,
  playerStats: [
    { team: "Lakers", playerName: "LeBron James", points: 38, rebounds: 8, assists: 9, rawStats: {} },
    { team: "Celtics", playerName: "Jayson Tatum", points: 32, rebounds: 7, assists: 5, rawStats: {} },
    { team: "Lakers", playerName: "A. Davis", points: 21, rebounds: 16, assists: 3, rawStats: {} },
    { team: "Celtics", playerName: "J. Holiday", points: 11, rebounds: 10, assists: 12, rawStats: {} },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 0, awayScore: 3, scoreChanged: true, pointsScored: 3, periodLabel: "Q1" },
    { playIndex: 2, quarter: 1, homeScore: 2, awayScore: 3, scoreChanged: true, pointsScored: 2, periodLabel: "Q1" },
    { playIndex: 3, quarter: 1, homeScore: 5, awayScore: 3, scoreChanged: true, pointsScored: 3, periodLabel: "Q1" },
    { playIndex: 4, quarter: 1, homeScore: 5, awayScore: 8, scoreChanged: true, pointsScored: 5, periodLabel: "Q1" },
    { playIndex: 5, quarter: 2, homeScore: 8, awayScore: 8, scoreChanged: true, pointsScored: 3, periodLabel: "Q2" },
    { playIndex: 6, quarter: 2, homeScore: 8, awayScore: 12, scoreChanged: true, pointsScored: 4, periodLabel: "Q2" },
    // Lakers 10–0 run
    { playIndex: 7, quarter: 2, homeScore: 10, awayScore: 12, scoreChanged: true, pointsScored: 2, periodLabel: "Q2" },
    { playIndex: 8, quarter: 2, homeScore: 14, awayScore: 12, scoreChanged: true, pointsScored: 4, periodLabel: "Q2" },
    { playIndex: 9, quarter: 2, homeScore: 18, awayScore: 12, scoreChanged: true, pointsScored: 4, periodLabel: "Q2" },
    // Q4 lead change
    { playIndex: 10, quarter: 4, homeScore: 100, awayScore: 101, scoreChanged: true, pointsScored: 3, periodLabel: "Q4" },
    { playIndex: 11, quarter: 4, homeScore: 104, awayScore: 101, scoreChanged: true, pointsScored: 4, periodLabel: "Q4" },
    { playIndex: 12, quarter: 4, homeScore: 112, awayScore: 108, scoreChanged: true, pointsScored: 2, tier: 1, description: "LeBron James drives for the go-ahead layup with 12 seconds left", periodLabel: "Q4" },
  ],
};

const NFL_BOX = {
  sport: "NFL",
  homeTeam: "Chiefs",
  awayTeam: "Eagles",
  homeScore: 27,
  awayScore: 10,
  playerStats: [
    { team: "Chiefs", playerName: "P. Mahomes", yards: 0, touchdowns: 0, rawStats: { passingYards: 312, passingTouchdowns: 3 } },
    { team: "Chiefs", playerName: "I. Pacheco", yards: 118, touchdowns: 1, rawStats: {} },
    { team: "Eagles", playerName: "J. Hurts", yards: 45, touchdowns: 1, rawStats: { passingYards: 198, passingTouchdowns: 0 } },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 7, awayScore: 0, scoreChanged: true, pointsScored: 7 },
    { playIndex: 2, quarter: 1, homeScore: 7, awayScore: 7, scoreChanged: true, pointsScored: 7 },
    { playIndex: 3, quarter: 2, homeScore: 14, awayScore: 7, scoreChanged: true, pointsScored: 7 },
    { playIndex: 4, quarter: 3, homeScore: 21, awayScore: 7, scoreChanged: true, pointsScored: 7 },
    { playIndex: 5, quarter: 3, homeScore: 21, awayScore: 10, scoreChanged: true, pointsScored: 3 },
    { playIndex: 6, quarter: 4, homeScore: 27, awayScore: 10, scoreChanged: true, pointsScored: 6, tier: 1, description: "Mahomes to Kelce for the TD to put it away" },
  ],
};

const MLB_BOX = {
  sport: "MLB",
  homeTeam: "Dodgers",
  awayTeam: "Yankees",
  homeScore: 7,
  awayScore: 3,
  mlbBatters: [
    { team: "Dodgers", playerName: "F. Freeman", homeRuns: 2, rbi: 5, hits: 3, atBats: 4 },
    { team: "Yankees", playerName: "A. Judge", homeRuns: 1, rbi: 2, hits: 2, atBats: 4 },
    { team: "Yankees", playerName: "J. Soto", homeRuns: 0, rbi: 3, hits: 2, atBats: 4 },
  ],
  mlbPitchers: [
    { team: "Dodgers", playerName: "Y. Yamamoto", inningsPitched: "9.0", strikeOuts: 11, earnedRuns: 3, era: "3.12" },
    { team: "Yankees", playerName: "G. Cole", inningsPitched: "5.1", strikeOuts: 7, earnedRuns: 5, era: "4.21" },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 0, awayScore: 2, scoreChanged: true, pointsScored: 2 },
    { playIndex: 2, quarter: 2, homeScore: 3, awayScore: 2, scoreChanged: true, pointsScored: 3 },
    { playIndex: 3, quarter: 4, homeScore: 5, awayScore: 2, scoreChanged: true, pointsScored: 2 },
    { playIndex: 4, quarter: 7, homeScore: 5, awayScore: 3, scoreChanged: true, pointsScored: 1 },
    { playIndex: 5, quarter: 8, homeScore: 7, awayScore: 3, scoreChanged: true, pointsScored: 2 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────

async function post(
  request: APIRequestContext,
  body: unknown,
): Promise<SalientEventResult> {
  const res = await request.post(ENDPOINT, { data: body });
  expect(res.ok()).toBe(true);
  return (await res.json()) as SalientEventResult;
}

// ─── Core contract ────────────────────────────────────────

test.describe("salient-events API — core contract @smoke", () => {
  test("POST returns events array and narrativeType", async ({ request }) => {
    const result = await post(request, NBA_BOX);
    expect(Array.isArray(result.events)).toBe(true);
    expect(typeof result.narrativeType).toBe("string");
  });

  test("events array has at most 15 items across all sports", async ({ request }) => {
    for (const box of [NBA_BOX, NFL_BOX, MLB_BOX]) {
      const result = await post(request, box);
      expect(result.events.length).toBeLessThanOrEqual(15);
    }
  });

  test("every event has type, description, and impactWeight in valid ranges", async ({ request }) => {
    const validTypes: SalientEventType[] = ["lead-change", "scoring-run", "standout-stat", "key-play"];
    for (const box of [NBA_BOX, NFL_BOX, MLB_BOX]) {
      const { events } = await post(request, box);
      for (const ev of events) {
        expect(validTypes).toContain(ev.type as SalientEventType);
        expect(typeof ev.description).toBe("string");
        expect(ev.description.length).toBeGreaterThan(0);
        expect(ev.impactWeight).toBeGreaterThanOrEqual(0);
        expect(ev.impactWeight).toBeLessThanOrEqual(100);
      }
    }
  });

  test("events are sorted by impactWeight descending", async ({ request }) => {
    for (const box of [NBA_BOX, NFL_BOX, MLB_BOX]) {
      const { events } = await post(request, box);
      for (let i = 1; i < events.length; i++) {
        expect((events[i] as SalientEvent).impactWeight).toBeLessThanOrEqual(
          (events[i - 1] as SalientEvent).impactWeight,
        );
      }
    }
  });

  test("narrativeType is exactly one of the five valid values", async ({ request }) => {
    const valid: NarrativeType[] = ["comeback", "dominant", "blowout", "back-and-forth", "defensive"];
    for (const box of [NBA_BOX, NFL_BOX, MLB_BOX]) {
      const { narrativeType } = await post(request, box);
      expect(valid).toContain(narrativeType as NarrativeType);
    }
  });

  test("400 returned for missing required fields", async ({ request }) => {
    const res = await request.post(ENDPOINT, { data: { sport: "NBA" } });
    expect(res.status()).toBe(400);
  });
});

// ─── NBA-specific ─────────────────────────────────────────

test.describe("NBA box score", () => {
  test("detects at least one lead-change event", async ({ request }) => {
    const { events } = await post(request, NBA_BOX);
    expect(events.some((e: SalientEvent) => e.type === "lead-change")).toBe(true);
  });

  test("detects 38-point standout stat for LeBron", async ({ request }) => {
    const { events } = await post(request, NBA_BOX);
    const e = events.find((ev: SalientEvent) => ev.type === "standout-stat" && ev.description.includes("LeBron"));
    expect(e).toBeTruthy();
  });

  test("detects triple-double for J. Holiday", async ({ request }) => {
    const { events } = await post(request, NBA_BOX);
    const e = events.find((ev: SalientEvent) => ev.description.includes("triple-double"));
    expect(e).toBeTruthy();
    expect(e?.type).toBe("standout-stat");
  });

  test("detects 16-rebound standout stat for A. Davis", async ({ request }) => {
    const { events } = await post(request, NBA_BOX);
    const e = events.find((ev: SalientEvent) => ev.description.includes("rebounds") && ev.description.includes("Davis"));
    expect(e).toBeTruthy();
  });

  test("detects tier-1 key play for LeBron walk-off", async ({ request }) => {
    const { events } = await post(request, NBA_BOX);
    const e = events.find((ev: SalientEvent) => ev.type === "key-play" && ev.description.includes("LeBron"));
    expect(e).toBeTruthy();
    expect(e!.impactWeight).toBeGreaterThanOrEqual(80);
  });

  test("detects scoring run from plays", async ({ request }) => {
    const { events } = await post(request, NBA_BOX);
    expect(events.some((e: SalientEvent) => e.type === "scoring-run")).toBe(true);
  });

  test("close game yields back-and-forth or comeback narrative", async ({ request }) => {
    const { narrativeType } = await post(request, NBA_BOX);
    expect(["back-and-forth", "comeback"]).toContain(narrativeType);
  });
});

// ─── NFL-specific ─────────────────────────────────────────

test.describe("NFL box score", () => {
  test("detects 300+ passing yards standout stat", async ({ request }) => {
    const { events } = await post(request, NFL_BOX);
    const e = events.find((ev: SalientEvent) => ev.type === "standout-stat" && ev.description.includes("Mahomes") && ev.description.includes("312"));
    expect(e).toBeTruthy();
  });

  test("detects 3-TD-pass standout stat", async ({ request }) => {
    const { events } = await post(request, NFL_BOX);
    const e = events.find((ev: SalientEvent) => ev.type === "standout-stat" && ev.description.includes("touchdown passes"));
    expect(e).toBeTruthy();
  });

  test("detects 100+ rushing yards for Pacheco", async ({ request }) => {
    const { events } = await post(request, NFL_BOX);
    const e = events.find((ev: SalientEvent) => ev.type === "standout-stat" && ev.description.includes("Pacheco") && ev.description.includes("118"));
    expect(e).toBeTruthy();
  });

  test("detects tier-1 key play", async ({ request }) => {
    const { events } = await post(request, NFL_BOX);
    const e = events.find((ev: SalientEvent) => ev.type === "key-play" && ev.description.includes("Mahomes"));
    expect(e).toBeTruthy();
  });

  test("blowout narrative for 17-point margin", async ({ request }) => {
    const { narrativeType } = await post(request, NFL_BOX);
    expect(narrativeType).toBe("blowout");
  });
});

// ─── MLB-specific ─────────────────────────────────────────

test.describe("MLB box score", () => {
  test("detects 2-home-run standout stat for Freeman", async ({ request }) => {
    const { events } = await post(request, MLB_BOX);
    const e = events.find((ev: SalientEvent) => ev.type === "standout-stat" && ev.description.includes("Freeman") && ev.description.includes("2 home run"));
    expect(e).toBeTruthy();
  });

  test("detects 3-RBI standout stat for Soto", async ({ request }) => {
    const { events } = await post(request, MLB_BOX);
    const e = events.find((ev: SalientEvent) => ev.type === "standout-stat" && ev.description.includes("Soto"));
    expect(e).toBeTruthy();
  });

  test("detects complete-game standout with K count", async ({ request }) => {
    const { events } = await post(request, MLB_BOX);
    const e = events.find((ev: SalientEvent) => ev.description.includes("complete game"));
    expect(e).toBeTruthy();
    expect(e?.type).toBe("standout-stat");
    expect(e?.description).toMatch(/11 K/);
  });

  test("detects lead-change when teams swap leads", async ({ request }) => {
    const { events } = await post(request, MLB_BOX);
    expect(events.some((e: SalientEvent) => e.type === "lead-change")).toBe(true);
  });

  test("dominant or back-and-forth narrative for 4-run margin", async ({ request }) => {
    // margin = 4 < 5 (blowout threshold) → dominant or back-and-forth
    const { narrativeType } = await post(request, MLB_BOX);
    expect(["dominant", "back-and-forth", "comeback"]).toContain(narrativeType);
  });
});

// ─── Edge cases ───────────────────────────────────────────

test.describe("edge cases", () => {
  test("no plays or stats returns valid structure", async ({ request }) => {
    // 120-95: margin = 25 (blowout), total = 215 (not defensive)
    const result = await post(request, {
      sport: "NBA",
      homeTeam: "Heat",
      awayTeam: "Bulls",
      homeScore: 120,
      awayScore: 95,
    });
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.events.length).toBeLessThanOrEqual(15);
    expect(result.narrativeType).toBe("blowout");
  });

  test("defensive narrative for low-scoring NBA game (total < 185)", async ({ request }) => {
    const { narrativeType } = await post(request, {
      sport: "NBA", homeTeam: "Jazz", awayTeam: "Grizzlies", homeScore: 88, awayScore: 85,
    });
    expect(narrativeType).toBe("defensive");
  });

  test("defensive narrative for low-scoring NFL game (total ≤ 27)", async ({ request }) => {
    const { narrativeType } = await post(request, {
      sport: "NFL", homeTeam: "Steelers", awayTeam: "Bears", homeScore: 13, awayScore: 10,
    });
    expect(narrativeType).toBe("defensive");
  });

  test("defensive narrative for low-scoring MLB game (total ≤ 4)", async ({ request }) => {
    const { narrativeType } = await post(request, {
      sport: "MLB", homeTeam: "Padres", awayTeam: "Mets", homeScore: 2, awayScore: 1,
    });
    expect(narrativeType).toBe("defensive");
  });

  test("comeback narrative when winner overcame large deficit", async ({ request }) => {
    const { narrativeType } = await post(request, {
      sport: "NBA",
      homeTeam: "Nets",
      awayTeam: "Knicks",
      homeScore: 105,
      awayScore: 95,
      plays: [
        { playIndex: 1, quarter: 1, homeScore: 0, awayScore: 15, scoreChanged: true, pointsScored: 15 },
        { playIndex: 2, quarter: 3, homeScore: 10, awayScore: 20, scoreChanged: true, pointsScored: 10 },
        { playIndex: 3, quarter: 4, homeScore: 20, awayScore: 20, scoreChanged: true, pointsScored: 10 },
        { playIndex: 4, quarter: 4, homeScore: 25, awayScore: 20, scoreChanged: true, pointsScored: 5 },
        { playIndex: 5, quarter: 4, homeScore: 30, awayScore: 20, scoreChanged: true, pointsScored: 5 },
      ],
    });
    expect(narrativeType).toBe("comeback");
  });

  test("sport string is case-insensitive", async ({ request }) => {
    const lower = await post(request, { sport: "nba", homeTeam: "A", awayTeam: "B", homeScore: 110, awayScore: 85 });
    const upper = await post(request, { sport: "NBA", homeTeam: "A", awayTeam: "B", homeScore: 110, awayScore: 85 });
    expect(lower.narrativeType).toBe(upper.narrativeType);
  });
});
