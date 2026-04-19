/**
 * ISSUE-036: Numeric fact-verification layer for AI game stories.
 * Tests call POST /api/ai/verify with pre-constructed story/box-score pairs.
 * 5 valid pairs pass; 5 pairs with injected numeric errors are rejected.
 * No LLM call — verification is deterministic.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const ENDPOINT = "/api/ai/verify";

// ─── Fixture definitions ───────────────────────────────────

/**
 * Each fixture provides a box score and two stories: one with only
 * numbers derivable from the box score (valid), one with an injected
 * hallucinated number (invalid).
 */

const FIXTURE_1_BOX = {
  sport: "NBA",
  homeTeam: "Lakers",
  awayTeam: "Celtics",
  homeScore: 115,
  awayScore: 98,
  playerStats: [
    { team: "Lakers", playerName: "LeBron James", points: 30, rebounds: 8, assists: 7, rawStats: {} },
  ],
};
const FIXTURE_1_VALID_STORY =
  "LeBron James scored 30 points and the Lakers defeated the Celtics 115 to 98.";
// Injected error: 35 (LeBron's actual points were 30)
const FIXTURE_1_INVALID_STORY =
  "LeBron James scored 35 points and the Lakers defeated the Celtics 115 to 98.";

const FIXTURE_2_BOX = {
  sport: "NFL",
  homeTeam: "Chiefs",
  awayTeam: "Eagles",
  homeScore: 27,
  awayScore: 14,
  playerStats: [
    { team: "Chiefs", playerName: "Patrick Mahomes", yards: 0, touchdowns: 0, rawStats: { passingYards: 312, passingTouchdowns: 3 } },
  ],
};
const FIXTURE_2_VALID_STORY =
  "Mahomes threw for 312 yards and 3 touchdowns as the Chiefs won 27 to 14.";
// Injected error: 350 (actual passing yards were 312)
const FIXTURE_2_INVALID_STORY =
  "Mahomes threw for 350 yards and 3 touchdowns as the Chiefs won 27 to 14.";

const FIXTURE_3_BOX = {
  sport: "MLB",
  homeTeam: "Dodgers",
  awayTeam: "Giants",
  homeScore: 5,
  awayScore: 3,
  mlbBatters: [
    { team: "Dodgers", playerName: "Freddie Freeman", homeRuns: 2, rbi: 3, hits: 2, atBats: 4 },
  ],
};
const FIXTURE_3_VALID_STORY =
  "Freeman hit 2 home runs and drove in 3 runs as the Dodgers won 5 to 3.";
// Injected error: 6 (actual RBI were 3)
const FIXTURE_3_INVALID_STORY =
  "Freeman hit 2 home runs and drove in 6 runs as the Dodgers won 5 to 3.";

const FIXTURE_4_BOX = {
  sport: "NBA",
  homeTeam: "Thunder",
  awayTeam: "Spurs",
  homeScore: 98,
  awayScore: 87,
  playerStats: [
    { team: "Thunder", playerName: "SGA", points: 40, rebounds: 5, assists: 6, rawStats: {} },
  ],
};
const FIXTURE_4_VALID_STORY =
  "SGA erupted for 40 points as the Thunder outlasted the Spurs 98 to 87.";
// Injected error: 45 (actual points were 40)
const FIXTURE_4_INVALID_STORY =
  "SGA erupted for 45 points as the Thunder outlasted the Spurs 98 to 87.";

const FIXTURE_5_BOX = {
  sport: "NFL",
  homeTeam: "Bills",
  awayTeam: "Dolphins",
  homeScore: 24,
  awayScore: 17,
  playerStats: [
    { team: "Bills", playerName: "Damien Harris", yards: 120, touchdowns: 2, rawStats: {} },
  ],
};
const FIXTURE_5_VALID_STORY =
  "Harris rushed for 120 yards and 2 touchdowns as the Bills held on 24 to 17.";
// Injected error: 130 (actual rushing yards were 120)
const FIXTURE_5_INVALID_STORY =
  "Harris rushed for 130 yards and 2 touchdowns as the Bills held on 24 to 17.";

// ─── Helpers ──────────────────────────────────────────────

type VerifyResponse = {
  valid: boolean;
  rejectedNumbers: number[];
  storyNumbers: number[];
  whitelistSize: number;
};

async function verify(
  request: APIRequestContext,
  story: string,
  boxScore: unknown,
): Promise<VerifyResponse> {
  const res = await request.post(ENDPOINT, { data: { story, boxScore } });
  expect(res.ok(), `POST ${ENDPOINT} returned ${res.status()}`).toBe(true);
  return (await res.json()) as VerifyResponse;
}

// ─── Valid fixtures (should all pass) ─────────────────────

test.describe("fact-verification — valid stories @smoke", () => {
  test("fixture 1 (NBA): LeBron 30 pts, 115-98 — passes", async ({ request }) => {
    const result = await verify(request, FIXTURE_1_VALID_STORY, FIXTURE_1_BOX);
    expect(result.valid).toBe(true);
    expect(result.rejectedNumbers).toHaveLength(0);
  });

  test("fixture 2 (NFL): Mahomes 312 yds, Chiefs 27-14 — passes", async ({ request }) => {
    const result = await verify(request, FIXTURE_2_VALID_STORY, FIXTURE_2_BOX);
    expect(result.valid).toBe(true);
    expect(result.rejectedNumbers).toHaveLength(0);
  });

  test("fixture 3 (MLB): Freeman 2 HR, 3 RBI, Dodgers 5-3 — passes", async ({ request }) => {
    const result = await verify(request, FIXTURE_3_VALID_STORY, FIXTURE_3_BOX);
    expect(result.valid).toBe(true);
    expect(result.rejectedNumbers).toHaveLength(0);
  });

  test("fixture 4 (NBA): SGA 40 pts, Thunder 98-87 — passes", async ({ request }) => {
    const result = await verify(request, FIXTURE_4_VALID_STORY, FIXTURE_4_BOX);
    expect(result.valid).toBe(true);
    expect(result.rejectedNumbers).toHaveLength(0);
  });

  test("fixture 5 (NFL): Harris 120 yds, Bills 24-17 — passes", async ({ request }) => {
    const result = await verify(request, FIXTURE_5_VALID_STORY, FIXTURE_5_BOX);
    expect(result.valid).toBe(true);
    expect(result.rejectedNumbers).toHaveLength(0);
  });
});

// ─── Invalid fixtures (each has one injected error) ────────

test.describe("fact-verification — injected numeric errors @smoke", () => {
  test("fixture 1 (NBA): hallucinated 35 pts (actual 30) — rejected", async ({ request }) => {
    const result = await verify(request, FIXTURE_1_INVALID_STORY, FIXTURE_1_BOX);
    expect(result.valid).toBe(false);
    expect(result.rejectedNumbers).toContain(35);
  });

  test("fixture 2 (NFL): hallucinated 350 yds (actual 312) — rejected", async ({ request }) => {
    const result = await verify(request, FIXTURE_2_INVALID_STORY, FIXTURE_2_BOX);
    expect(result.valid).toBe(false);
    expect(result.rejectedNumbers).toContain(350);
  });

  test("fixture 3 (MLB): hallucinated 6 RBI (actual 3) — rejected", async ({ request }) => {
    const result = await verify(request, FIXTURE_3_INVALID_STORY, FIXTURE_3_BOX);
    expect(result.valid).toBe(false);
    expect(result.rejectedNumbers).toContain(6);
  });

  test("fixture 4 (NBA): hallucinated 45 pts (actual 40) — rejected", async ({ request }) => {
    const result = await verify(request, FIXTURE_4_INVALID_STORY, FIXTURE_4_BOX);
    expect(result.valid).toBe(false);
    expect(result.rejectedNumbers).toContain(45);
  });

  test("fixture 5 (NFL): hallucinated 130 yds (actual 120) — rejected", async ({ request }) => {
    const result = await verify(request, FIXTURE_5_INVALID_STORY, FIXTURE_5_BOX);
    expect(result.valid).toBe(false);
    expect(result.rejectedNumbers).toContain(130);
  });
});

// ─── API contract ──────────────────────────────────────────

test.describe("fact-verification — API contract @smoke", () => {
  test("returns 400 when story is missing", async ({ request }) => {
    const res = await request.post(ENDPOINT, { data: { boxScore: FIXTURE_1_BOX } });
    expect(res.status()).toBe(400);
  });

  test("returns 400 when boxScore fields are missing", async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { story: "Some story.", boxScore: { sport: "NBA" } },
    });
    expect(res.status()).toBe(400);
  });

  test("response always includes valid, rejectedNumbers, storyNumbers, whitelistSize", async ({ request }) => {
    const result = await verify(request, FIXTURE_1_VALID_STORY, FIXTURE_1_BOX);
    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.rejectedNumbers)).toBe(true);
    expect(Array.isArray(result.storyNumbers)).toBe(true);
    expect(typeof result.whitelistSize).toBe("number");
    expect(result.whitelistSize).toBeGreaterThan(0);
  });

  test("storyNumbers contains every distinct number from the story", async ({ request }) => {
    const result = await verify(request, FIXTURE_2_VALID_STORY, FIXTURE_2_BOX);
    // "Mahomes threw for 312 yards and 3 touchdowns as the Chiefs won 27 to 14."
    expect(result.storyNumbers).toContain(312);
    expect(result.storyNumbers).toContain(3);
    expect(result.storyNumbers).toContain(27);
    expect(result.storyNumbers).toContain(14);
  });
});
