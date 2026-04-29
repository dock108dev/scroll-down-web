import { describe, it, expect } from "vitest";
import type { PlayEntry, PlayerStat } from "@/lib/types";
import { extractSalientEvents } from "@/lib/salient-events";

/** Minimal score-changing plays to drive classifyNarrative lead-change / deficit tracking */
function rallyPlays(
  sequence: Array<{ h: number; a: number }>,
  startIndex = 1,
): PlayEntry[] {
  return sequence.map((sc, i) => ({
    playIndex: startIndex + i,
    scoreChanged: true,
    homeScore: sc.h,
    awayScore: sc.a,
    quarter: 1,
  }));
}

describe("extractSalientEvents narrative + extractors", () => {
  it("classifies NBA defensive when combined score is low", () => {
    const r = extractSalientEvents({
      sport: "NBA",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 89,
      awayScore: 85,
      plays: [],
    });
    expect(r.narrativeType).toBe("defensive");
  });

  it("classifies NBA blowout", () => {
    const r = extractSalientEvents({
      sport: "NBA",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 120,
      awayScore: 90,
      plays: [],
    });
    expect(r.narrativeType).toBe("blowout");
  });

  it("classifies NBA comeback when winner trailed big", () => {
    const plays = rallyPlays([
      { h: 0, a: 18 },
      { h: 102, a: 99 },
    ]);
    const r = extractSalientEvents({
      sport: "NBA",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 102,
      awayScore: 99,
      plays,
    });
    expect(r.narrativeType).toBe("comeback");
  });

  it("classifies NBA back-and-forth when lead changes pile up", () => {
    const plays: PlayEntry[] = [];
    let idx = 1;
    const scores: Array<[number, number]> = [
      [2, 0],
      [2, 3],
      [5, 3],
      [5, 6],
      [8, 6],
      [8, 10],
      [12, 10],
      [12, 14],
      [16, 14],
      [16, 18],
      [20, 18],
      [20, 22],
      [24, 22],
      [24, 26],
      [110, 108],
    ];
    for (const [h, a] of scores) {
      plays.push({
        playIndex: idx++,
        scoreChanged: true,
        homeScore: h,
        awayScore: a,
        quarter: 1,
      });
    }
    const r = extractSalientEvents({
      sport: "NBA",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 110,
      awayScore: 108,
      plays,
    });
    expect(r.narrativeType).toBe("back-and-forth");
  });

  it("classifies NBA dominant for mid-size margin", () => {
    const r = extractSalientEvents({
      sport: "NBA",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 108,
      awayScore: 96,
      plays: [],
    });
    expect(r.narrativeType).toBe("dominant");
  });

  it("extracts NBA triple-double and high-point outings", () => {
    const r = extractSalientEvents({
      sport: "NBA",
      homeTeam: "LAL",
      awayTeam: "BOS",
      homeScore: 112,
      awayScore: 105,
      plays: [],
      playerStats: [
        {
          team: "LAL",
          playerName: "Triple",
          points: 12,
          rebounds: 12,
          assists: 12,
          rawStats: {},
        },
        {
          team: "LAL",
          playerName: "Bucket",
          points: 41,
          rebounds: 4,
          assists: 2,
          rawStats: {},
        },
      ],
    });
    const desc = r.events.map((e) => e.description).join(" | ");
    expect(desc).toMatch(/triple-double/i);
    expect(desc).toMatch(/41/);
  });

  it("extracts NFL passer and rusher standout tiers", () => {
    const playerStats: PlayerStat[] = [
      {
        team: "KC",
        playerName: "Big Arm",
        rawStats: { passingYards: 305, passingTouchdowns: 3 },
        yards: 45,
        touchdowns: 2,
      },
      {
        team: "KC",
        playerName: "Cannon",
        rawStats: { passingYards: 410, passingTouchdowns: 4 },
        yards: 20,
        touchdowns: 0,
      },
    ];
    const r = extractSalientEvents({
      sport: "NFL",
      homeTeam: "KC",
      awayTeam: "SF",
      homeScore: 45,
      awayScore: 10,
      plays: [],
      playerStats,
    });
    const desc = r.events.map((e) => e.description).join(" | ");
    expect(desc).toMatch(/305/);
    expect(desc).toMatch(/410/);
    expect(desc).toMatch(/touchdown passes/);
    expect(desc).toMatch(/rushing touchdowns/);
  });

  it("classifies NFL defensive / blowout / comeback branches", () => {
    expect(
      extractSalientEvents({
        sport: "NFL",
        homeTeam: "H",
        awayTeam: "A",
        homeScore: 10,
        awayScore: 14,
        plays: [],
      }).narrativeType,
    ).toBe("defensive");

    expect(
      extractSalientEvents({
        sport: "NFL",
        homeTeam: "H",
        awayTeam: "A",
        homeScore: 38,
        awayScore: 14,
        plays: [],
      }).narrativeType,
    ).toBe("blowout");

    const nflComeback = extractSalientEvents({
      sport: "NFL",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 28,
      awayScore: 24,
      plays: rallyPlays([
        { h: 0, a: 17 },
        { h: 28, a: 24 },
      ]),
    });
    expect(nflComeback.narrativeType).toBe("comeback");
  });

  it("classifies MLB branches including generic low-scoring defensive", () => {
    expect(
      extractSalientEvents({
        sport: "MLB",
        homeTeam: "H",
        awayTeam: "A",
        homeScore: 1,
        awayScore: 2,
        plays: [],
      }).narrativeType,
    ).toBe("defensive");

    expect(
      extractSalientEvents({
        sport: "MLB",
        homeTeam: "H",
        awayTeam: "A",
        homeScore: 9,
        awayScore: 2,
        plays: [],
      }).narrativeType,
    ).toBe("blowout");
  });

  it("uses generic sport classifier for non NBA/NFL/MLB (comeback when big deficit reversed)", () => {
    expect(
      extractSalientEvents({
        sport: "NHL",
        homeTeam: "H",
        awayTeam: "A",
        homeScore: 5,
        awayScore: 4,
        plays: rallyPlays([
          { h: 0, a: 12 },
          { h: 5, a: 4 },
        ]),
      }).narrativeType,
    ).toBe("comeback");
  });

  it("extracts lead-change with period label and scoring-run thresholds", () => {
    const nflPlays: PlayEntry[] = [
      {
        playIndex: 1,
        scoreChanged: true,
        homeScore: 7,
        awayScore: 0,
        quarter: 1,
      },
      {
        playIndex: 2,
        scoreChanged: true,
        homeScore: 7,
        awayScore: 14,
        quarter: 1,
      },
      {
        playIndex: 3,
        scoreChanged: true,
        homeScore: 14,
        awayScore: 14,
        quarter: 2,
        periodLabel: "Q2",
      },
    ];
    const nfl = extractSalientEvents({
      sport: "NFL",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 14,
      awayScore: 14,
      plays: nflPlays,
    });
    expect(nfl.events.some((e) => e.type === "lead-change")).toBe(true);

    const mlbRun = extractSalientEvents({
      sport: "MLB",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 5,
      awayScore: 0,
      plays: [
        {
          playIndex: 1,
          scoreChanged: true,
          homeScore: 1,
          awayScore: 0,
          quarter: 1,
        },
        {
          playIndex: 2,
          scoreChanged: true,
          homeScore: 2,
          awayScore: 0,
          quarter: 1,
        },
        {
          playIndex: 3,
          scoreChanged: true,
          homeScore: 4,
          awayScore: 0,
          quarter: 1,
        },
      ],
    });
    expect(mlbRun.events.some((e) => e.type === "scoring-run")).toBe(true);
  });

  it("extracts MLB batter single-HR and RBI rows without double-counting HR", () => {
    const r = extractSalientEvents({
      sport: "MLB",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 6,
      awayScore: 0,
      plays: [],
      mlbBatters: [
        { team: "H", playerName: "Dinger", homeRuns: 1, rbi: 1 },
        { team: "H", playerName: "Ribby4", homeRuns: 0, rbi: 4 },
        { team: "H", playerName: "Ribby3", homeRuns: 0, rbi: 3 },
      ],
      mlbPitchers: [],
    });
    const desc = r.events.map((e) => e.description).join(" | ");
    expect(desc).toMatch(/home run/i);
    expect(desc).toMatch(/4/);
    expect(desc).toMatch(/3/);
  });

  it("extracts MLB pitcher standouts (complete game, high strikeouts)", () => {
    const r = extractSalientEvents({
      sport: "MLB",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 2,
      awayScore: 1,
      plays: [],
      mlbBatters: [],
      mlbPitchers: [
        {
          team: "H",
          playerName: "Ace",
          inningsPitched: "9.0",
          strikeOuts: 9,
        },
        {
          team: "A",
          playerName: "Fireball",
          inningsPitched: "7.0",
          strikeOuts: 11,
        },
        {
          team: "H",
          playerName: "Closer",
          inningsPitched: "1.0",
          strikeOuts: 8,
        },
      ],
    });
    const desc = r.events.map((e) => e.description).join(" ");
    expect(desc).toMatch(/complete game/i);
    expect(desc).toMatch(/11/);
    expect(desc).toMatch(/8/);
  });

  it("classifies MLB back-and-forth when margins are tight and totals are moderate", () => {
    const r = extractSalientEvents({
      sport: "MLB",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 5,
      awayScore: 4,
      plays: [],
    });
    expect(r.narrativeType).toBe("back-and-forth");
  });

  it("extracts tier-1 key plays and decisive final score in a close game", () => {
    const plays: PlayEntry[] = [
      {
        playIndex: 1,
        scoreChanged: true,
        homeScore: 2,
        awayScore: 0,
        quarter: 4,
        tier: 1,
        description: "Explosive dunk",
        eventId: "e1",
        gameClock: "1:00",
      },
      {
        playIndex: 2,
        scoreChanged: true,
        homeScore: 2,
        awayScore: 3,
        quarter: 4,
        pointsScored: 3,
      },
    ];
    const r = extractSalientEvents({
      sport: "NBA",
      homeTeam: "H",
      awayTeam: "A",
      homeScore: 2,
      awayScore: 3,
      plays,
    });
    const key = r.events.filter((e) => e.type === "key-play");
    expect(key.length).toBeGreaterThanOrEqual(1);
    expect(key.some((e) => e.description === "Explosive dunk")).toBe(true);
  });
});
