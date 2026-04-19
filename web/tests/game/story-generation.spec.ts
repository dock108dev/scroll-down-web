/**
 * ISSUE-035: Slot-filled prompt templates and anti-filler ruleset.
 * Tests call POST /api/ai/story and assert no banned phrases appear in stories.
 * Tests skip gracefully when ANTHROPIC_API_KEY is not configured (503 response).
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { signInWithMagicLink } from "../api-auth";

const ENDPOINT = "/api/ai/story";

/** Cached `sd-session` for `/api/ai/story` (route requires verifySession). */
let storySessionCookie: string | undefined;

async function ensureStorySessionCookie(request: APIRequestContext): Promise<boolean> {
  if (storySessionCookie) return true;
  try {
    storySessionCookie = await signInWithMagicLink(
      request,
      `story-e2e-${Date.now()}@test.scrolldown.dev`,
    );
    return true;
  } catch {
    return false;
  }
}

const BANNED_PHRASES = [
  "both teams fought hard",
  "thrilling contest",
  "back and forth",
  "hard fought",
];

// ─── NBA box scores (3 narrative types) ───────────────────

const NBA_COMEBACK = {
  sport: "NBA",
  homeTeam: "Nets",
  awayTeam: "Knicks",
  homeScore: 108,
  awayScore: 100,
  playerStats: [
    { team: "Nets", playerName: "Ben Simmons", points: 22, rebounds: 9, assists: 11, rawStats: {} },
    { team: "Knicks", playerName: "Julius Randle", points: 35, rebounds: 11, assists: 5, rawStats: {} },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 0, awayScore: 18, scoreChanged: true, pointsScored: 18, periodLabel: "Q1" },
    { playIndex: 2, quarter: 2, homeScore: 10, awayScore: 22, scoreChanged: true, pointsScored: 10, periodLabel: "Q2" },
    { playIndex: 3, quarter: 3, homeScore: 30, awayScore: 30, scoreChanged: true, pointsScored: 20, periodLabel: "Q3" },
    { playIndex: 4, quarter: 4, homeScore: 55, awayScore: 40, scoreChanged: true, pointsScored: 25, periodLabel: "Q4" },
    { playIndex: 5, quarter: 4, homeScore: 108, awayScore: 100, scoreChanged: true, pointsScored: 8, tier: 1, description: "Simmons finishes the alley-oop to seal it", periodLabel: "Q4" },
  ],
};

const NBA_BLOWOUT = {
  sport: "NBA",
  homeTeam: "Bucks",
  awayTeam: "Pistons",
  homeScore: 128,
  awayScore: 94,
  playerStats: [
    { team: "Bucks", playerName: "Giannis Antetokounmpo", points: 42, rebounds: 14, assists: 6, rawStats: {} },
    { team: "Bucks", playerName: "Khris Middleton", points: 31, rebounds: 6, assists: 4, rawStats: {} },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 12, awayScore: 4, scoreChanged: true, pointsScored: 8, periodLabel: "Q1" },
    { playIndex: 2, quarter: 2, homeScore: 38, awayScore: 14, scoreChanged: true, pointsScored: 10, periodLabel: "Q2" },
    { playIndex: 3, quarter: 3, homeScore: 80, awayScore: 50, scoreChanged: true, pointsScored: 8, periodLabel: "Q3" },
    { playIndex: 4, quarter: 4, homeScore: 128, awayScore: 94, scoreChanged: true, pointsScored: 6, periodLabel: "Q4" },
  ],
};

const NBA_DEFENSIVE = {
  sport: "NBA",
  homeTeam: "Jazz",
  awayTeam: "Grizzlies",
  homeScore: 88,
  awayScore: 82,
  playerStats: [
    { team: "Jazz", playerName: "Walker Kessler", points: 14, rebounds: 16, assists: 3, rawStats: {} },
    { team: "Grizzlies", playerName: "Ja Morant", points: 26, rebounds: 6, assists: 9, rawStats: {} },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 0, awayScore: 5, scoreChanged: true, pointsScored: 5, periodLabel: "Q1" },
    { playIndex: 2, quarter: 2, homeScore: 8, awayScore: 5, scoreChanged: true, pointsScored: 8, periodLabel: "Q2" },
    { playIndex: 3, quarter: 3, homeScore: 20, awayScore: 18, scoreChanged: true, pointsScored: 5, periodLabel: "Q3" },
    { playIndex: 4, quarter: 4, homeScore: 88, awayScore: 82, scoreChanged: true, pointsScored: 4, tier: 1, description: "Kessler blocks Morant's drive to preserve the lead", periodLabel: "Q4" },
  ],
};

// ─── NFL box scores (3 narrative types) ───────────────────

const NFL_BLOWOUT = {
  sport: "NFL",
  homeTeam: "Chiefs",
  awayTeam: "Eagles",
  homeScore: 35,
  awayScore: 10,
  playerStats: [
    { team: "Chiefs", playerName: "Patrick Mahomes", yards: 0, touchdowns: 0, rawStats: { passingYards: 321, passingTouchdowns: 4 } },
    { team: "Chiefs", playerName: "Isiah Pacheco", yards: 112, touchdowns: 2, rawStats: {} },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 7, awayScore: 0, scoreChanged: true, pointsScored: 7 },
    { playIndex: 2, quarter: 2, homeScore: 14, awayScore: 3, scoreChanged: true, pointsScored: 7 },
    { playIndex: 3, quarter: 3, homeScore: 28, awayScore: 3, scoreChanged: true, pointsScored: 14 },
    { playIndex: 4, quarter: 3, homeScore: 28, awayScore: 10, scoreChanged: true, pointsScored: 7 },
    { playIndex: 5, quarter: 4, homeScore: 35, awayScore: 10, scoreChanged: true, pointsScored: 7, tier: 1, description: "Pacheco punches it in from the 2-yard line" },
  ],
};

const NFL_COMEBACK = {
  sport: "NFL",
  homeTeam: "Bills",
  awayTeam: "Ravens",
  homeScore: 31,
  awayScore: 28,
  playerStats: [
    { team: "Bills", playerName: "Josh Allen", yards: 55, touchdowns: 2, rawStats: { passingYards: 348, passingTouchdowns: 3 } },
    { team: "Ravens", playerName: "Lamar Jackson", yards: 72, touchdowns: 2, rawStats: { passingYards: 290, passingTouchdowns: 2 } },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 0, awayScore: 14, scoreChanged: true, pointsScored: 14 },
    { playIndex: 2, quarter: 2, homeScore: 7, awayScore: 21, scoreChanged: true, pointsScored: 7 },
    { playIndex: 3, quarter: 3, homeScore: 14, awayScore: 21, scoreChanged: true, pointsScored: 7 },
    { playIndex: 4, quarter: 4, homeScore: 21, awayScore: 21, scoreChanged: true, pointsScored: 7 },
    { playIndex: 5, quarter: 4, homeScore: 28, awayScore: 28, scoreChanged: true, pointsScored: 7 },
    { playIndex: 6, quarter: 4, homeScore: 31, awayScore: 28, scoreChanged: true, pointsScored: 3, tier: 1, description: "Tyler Bass hits the 48-yard field goal with 0:03 left" },
  ],
};

const NFL_DOMINANT = {
  sport: "NFL",
  homeTeam: "49ers",
  awayTeam: "Panthers",
  homeScore: 24,
  awayScore: 7,
  playerStats: [
    { team: "49ers", playerName: "Brock Purdy", yards: 0, touchdowns: 0, rawStats: { passingYards: 267, passingTouchdowns: 3 } },
    { team: "49ers", playerName: "Christian McCaffrey", yards: 125, touchdowns: 1, rawStats: {} },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 7, awayScore: 0, scoreChanged: true, pointsScored: 7 },
    { playIndex: 2, quarter: 2, homeScore: 17, awayScore: 0, scoreChanged: true, pointsScored: 10 },
    { playIndex: 3, quarter: 3, homeScore: 24, awayScore: 0, scoreChanged: true, pointsScored: 7 },
    { playIndex: 4, quarter: 4, homeScore: 24, awayScore: 7, scoreChanged: true, pointsScored: 7 },
  ],
};

// ─── MLB box scores (3 narrative types) ───────────────────

const MLB_COMEBACK = {
  sport: "MLB",
  homeTeam: "Dodgers",
  awayTeam: "Giants",
  homeScore: 6,
  awayScore: 5,
  mlbBatters: [
    { team: "Dodgers", playerName: "Freddie Freeman", homeRuns: 1, rbi: 3, hits: 3, atBats: 4 },
    { team: "Giants", playerName: "Matt Chapman", homeRuns: 2, rbi: 4, hits: 2, atBats: 4 },
  ],
  mlbPitchers: [
    { team: "Dodgers", playerName: "Clayton Kershaw", inningsPitched: "7.0", strikeOuts: 9, earnedRuns: 4, era: "3.20" },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 0, awayScore: 4, scoreChanged: true, pointsScored: 4 },
    { playIndex: 2, quarter: 4, homeScore: 4, awayScore: 4, scoreChanged: true, pointsScored: 4 },
    { playIndex: 3, quarter: 7, homeScore: 4, awayScore: 5, scoreChanged: true, pointsScored: 1 },
    { playIndex: 4, quarter: 8, homeScore: 6, awayScore: 5, scoreChanged: true, pointsScored: 2, tier: 1, description: "Freeman hits a walk-off two-run double in the 8th" },
  ],
};

const MLB_BLOWOUT = {
  sport: "MLB",
  homeTeam: "Yankees",
  awayTeam: "Orioles",
  homeScore: 11,
  awayScore: 2,
  mlbBatters: [
    { team: "Yankees", playerName: "Aaron Judge", homeRuns: 2, rbi: 5, hits: 3, atBats: 4 },
    { team: "Yankees", playerName: "Juan Soto", homeRuns: 1, rbi: 3, hits: 2, atBats: 4 },
  ],
  mlbPitchers: [
    { team: "Yankees", playerName: "Gerrit Cole", inningsPitched: "8.0", strikeOuts: 11, earnedRuns: 2, era: "2.88" },
  ],
  plays: [
    { playIndex: 1, quarter: 1, homeScore: 4, awayScore: 0, scoreChanged: true, pointsScored: 4 },
    { playIndex: 2, quarter: 3, homeScore: 8, awayScore: 0, scoreChanged: true, pointsScored: 4 },
    { playIndex: 3, quarter: 5, homeScore: 8, awayScore: 2, scoreChanged: true, pointsScored: 2 },
    { playIndex: 4, quarter: 7, homeScore: 11, awayScore: 2, scoreChanged: true, pointsScored: 3 },
  ],
};

const MLB_DEFENSIVE = {
  sport: "MLB",
  homeTeam: "Mets",
  awayTeam: "Braves",
  homeScore: 2,
  awayScore: 1,
  mlbBatters: [
    { team: "Mets", playerName: "Pete Alonso", homeRuns: 1, rbi: 2, hits: 1, atBats: 4 },
  ],
  mlbPitchers: [
    { team: "Mets", playerName: "Kodai Senga", inningsPitched: "9.0", strikeOuts: 12, earnedRuns: 1, era: "2.45" },
    { team: "Braves", playerName: "Spencer Strider", inningsPitched: "8.0", strikeOuts: 10, earnedRuns: 2, era: "2.61" },
  ],
  plays: [
    { playIndex: 1, quarter: 4, homeScore: 2, awayScore: 0, scoreChanged: true, pointsScored: 2 },
    { playIndex: 2, quarter: 9, homeScore: 2, awayScore: 1, scoreChanged: true, pointsScored: 1 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────

type StoryResponse = {
  story: string;
  narrativeType: string;
  wordCount: number;
  sentenceCount: number;
};

async function postStory(
  request: APIRequestContext,
  box: unknown,
): Promise<StoryResponse | null> {
  if (!(await ensureStorySessionCookie(request))) {
    return null;
  }

  const res = await request.post(ENDPOINT, {
    data: box,
    headers: { Cookie: `sd-session=${storySessionCookie!}` },
  });

  if (res.status() === 503) {
    // ANTHROPIC_API_KEY not configured — skip gracefully
    return null;
  }

  expect(res.ok(), `Unexpected ${res.status()} for ${JSON.stringify(box)}`).toBe(true);
  return (await res.json()) as StoryResponse;
}

function assertNoBannedPhrases(story: string, label: string): void {
  const lower = story.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    expect(
      lower.includes(phrase.toLowerCase()),
      `Story for ${label} contains banned phrase: "${phrase}"\n\nStory: ${story}`,
    ).toBe(false);
  }
}

// ─── NBA tests ────────────────────────────────────────────

test.describe("story-generation — NBA @smoke", () => {
  test("comeback: no banned phrases, valid word/sentence counts", async ({ request }) => {
    const result = await postStory(request, NBA_COMEBACK);
    if (!result) return test.skip();
    assertNoBannedPhrases(result.story, "NBA comeback");
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.sentenceCount).toBeLessThanOrEqual(6);
    expect(result.narrativeType).toBe("comeback");
  });

  test("blowout: no banned phrases, valid word/sentence counts", async ({ request }) => {
    const result = await postStory(request, NBA_BLOWOUT);
    if (!result) return test.skip();
    assertNoBannedPhrases(result.story, "NBA blowout");
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.sentenceCount).toBeLessThanOrEqual(6);
    expect(result.narrativeType).toBe("blowout");
  });

  test("defensive: no banned phrases, valid word/sentence counts", async ({ request }) => {
    const result = await postStory(request, NBA_DEFENSIVE);
    if (!result) return test.skip();
    assertNoBannedPhrases(result.story, "NBA defensive");
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.sentenceCount).toBeLessThanOrEqual(6);
    expect(result.narrativeType).toBe("defensive");
  });
});

// ─── NFL tests ────────────────────────────────────────────

test.describe("story-generation — NFL", () => {
  test("blowout: no banned phrases, valid word/sentence counts", async ({ request }) => {
    const result = await postStory(request, NFL_BLOWOUT);
    if (!result) return test.skip();
    assertNoBannedPhrases(result.story, "NFL blowout");
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.sentenceCount).toBeLessThanOrEqual(6);
    expect(result.narrativeType).toBe("blowout");
  });

  test("comeback: no banned phrases, valid word/sentence counts", async ({ request }) => {
    const result = await postStory(request, NFL_COMEBACK);
    if (!result) return test.skip();
    assertNoBannedPhrases(result.story, "NFL comeback");
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.sentenceCount).toBeLessThanOrEqual(6);
    expect(result.narrativeType).toBe("comeback");
  });

  test("dominant: no banned phrases, valid word/sentence counts", async ({ request }) => {
    const result = await postStory(request, NFL_DOMINANT);
    if (!result) return test.skip();
    assertNoBannedPhrases(result.story, "NFL dominant");
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.sentenceCount).toBeLessThanOrEqual(6);
    expect(result.narrativeType).toBe("dominant");
  });
});

// ─── MLB tests ────────────────────────────────────────────

test.describe("story-generation — MLB", () => {
  test("comeback: no banned phrases, valid word/sentence counts", async ({ request }) => {
    const result = await postStory(request, MLB_COMEBACK);
    if (!result) return test.skip();
    assertNoBannedPhrases(result.story, "MLB comeback");
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.sentenceCount).toBeLessThanOrEqual(6);
    expect(result.narrativeType).toBe("comeback");
  });

  test("blowout: no banned phrases, valid word/sentence counts", async ({ request }) => {
    const result = await postStory(request, MLB_BLOWOUT);
    if (!result) return test.skip();
    assertNoBannedPhrases(result.story, "MLB blowout");
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.sentenceCount).toBeLessThanOrEqual(6);
    expect(result.narrativeType).toBe("blowout");
  });

  test("defensive: no banned phrases, valid word/sentence counts", async ({ request }) => {
    const result = await postStory(request, MLB_DEFENSIVE);
    if (!result) return test.skip();
    assertNoBannedPhrases(result.story, "MLB defensive");
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.sentenceCount).toBeLessThanOrEqual(6);
    expect(result.narrativeType).toBe("defensive");
  });
});

// ─── Validator contract ───────────────────────────────────

test.describe("story API — validation contract @smoke", () => {
  test("returns 400 for missing required fields", async ({ request }) => {
    if (!(await ensureStorySessionCookie(request))) {
      return test.skip(true, "Magic-link auth unavailable for API tests");
    }
    const res = await request.post(ENDPOINT, {
      data: { sport: "NBA" },
      headers: { Cookie: `sd-session=${storySessionCookie!}` },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 503 or a valid story structure", async ({ request }) => {
    if (!(await ensureStorySessionCookie(request))) {
      return test.skip(true, "Magic-link auth unavailable for API tests");
    }
    const res = await request.post(ENDPOINT, {
      data: NBA_COMEBACK,
      headers: { Cookie: `sd-session=${storySessionCookie!}` },
    });
    expect([200, 502, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as Record<string, unknown>;
      expect(typeof body.story).toBe("string");
      expect(typeof body.narrativeType).toBe("string");
      expect(typeof body.wordCount).toBe("number");
      expect(typeof body.sentenceCount).toBe("number");
    }
  });
});
