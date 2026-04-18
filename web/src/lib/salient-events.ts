import type { PlayEntry, PlayerStat, MLBBatterStat, MLBPitcherStat } from "./types";

// ─── Public types ─────────────────────────────────────────

export type SalientEventType = "lead-change" | "scoring-run" | "standout-stat" | "key-play";
export type NarrativeType = "comeback" | "dominant" | "blowout" | "back-and-forth" | "defensive";

export interface SalientEvent {
  type: SalientEventType;
  description: string;
  impactWeight: number; // 0–100
  metadata?: Record<string, unknown>;
}

export interface BoxScoreInput {
  sport: string; // "NBA" | "NFL" | "MLB" | ...
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  plays?: PlayEntry[];
  playerStats?: PlayerStat[];
  mlbBatters?: MLBBatterStat[];
  mlbPitchers?: MLBPitcherStat[];
}

export interface SalientEventResult {
  events: SalientEvent[];
  narrativeType: NarrativeType;
}

// ─── Internal helpers ─────────────────────────────────────

function upper(sport: string): string {
  return sport.toUpperCase().trim();
}

// ─── Lead-change extraction ───────────────────────────────

function extractLeadChanges(
  plays: PlayEntry[],
  homeTeam: string,
  awayTeam: string,
): SalientEvent[] {
  const events: SalientEvent[] = [];
  let prevLeader: "home" | "away" | null = null;
  const maxPeriod = plays.reduce((m, p) => Math.max(m, p.quarter ?? 1), 1);

  for (const play of plays) {
    if (!play.scoreChanged) continue;

    const home = play.homeScore ?? 0;
    const away = play.awayScore ?? 0;

    let leader: "home" | "away" | null = null;
    if (home > away) leader = "home";
    else if (away > home) leader = "away";

    if (leader !== null && prevLeader !== null && leader !== prevLeader) {
      const period = play.quarter ?? 1;
      // Later periods produce higher weights (range 60–95)
      const periodFraction = Math.min(1, period / Math.max(maxPeriod, 4));
      const weight = Math.min(95, Math.round(60 + periodFraction * 35));
      const leadTeam = leader === "home" ? homeTeam : awayTeam;
      events.push({
        type: "lead-change",
        description: `${leadTeam} takes the lead ${home}–${away}${play.periodLabel ? ` (${play.periodLabel})` : ""}`,
        impactWeight: weight,
        metadata: { period, homeScore: home, awayScore: away },
      });
    }

    if (leader !== null) prevLeader = leader;
  }

  return events;
}

// ─── Scoring-run extraction ───────────────────────────────

function extractScoringRuns(
  plays: PlayEntry[],
  sport: string,
  homeTeam: string,
  awayTeam: string,
): SalientEvent[] {
  const s = upper(sport);
  const events: SalientEvent[] = [];
  // Minimum consecutive points to qualify as a notable run
  const threshold = s === "NFL" ? 14 : s === "MLB" ? 3 : 8;

  let runSide: "home" | "away" | null = null;
  let runPts = 0;
  let prevHome = 0;
  let prevAway = 0;

  const flush = (closing: boolean) => {
    if (runPts >= threshold && runSide !== null) {
      const team = runSide === "home" ? homeTeam : awayTeam;
      const weight = Math.min(90, 50 + Math.round((runPts / threshold) * 15));
      const suffix = closing ? " to close the game" : "";
      events.push({
        type: "scoring-run",
        description: `${team} goes on a ${runPts}–0 run${suffix}`,
        impactWeight: weight,
        metadata: { side: runSide, points: runPts },
      });
    }
  };

  for (const play of plays) {
    if (!play.scoreChanged) continue;

    const home = play.homeScore ?? prevHome;
    const away = play.awayScore ?? prevAway;

    let scored: "home" | "away";
    if (home > prevHome) {
      scored = "home";
    } else if (away > prevAway) {
      scored = "away";
    } else {
      prevHome = home;
      prevAway = away;
      continue;
    }

    const pts = scored === "home" ? home - prevHome : away - prevAway;

    if (runSide === null) {
      runSide = scored;
      runPts = pts;
    } else if (scored === runSide) {
      runPts += pts;
    } else {
      flush(false);
      runSide = scored;
      runPts = pts;
    }

    prevHome = home;
    prevAway = away;
  }

  flush(true);
  return events;
}

// ─── Standout-stat extraction — NBA ──────────────────────

function extractNBAStandouts(playerStats: PlayerStat[]): SalientEvent[] {
  const events: SalientEvent[] = [];

  for (const p of playerStats) {
    const pts = p.points ?? 0;
    const reb = p.rebounds ?? 0;
    const ast = p.assists ?? 0;

    if (pts >= 10 && reb >= 10 && ast >= 10) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} records a triple-double (${pts} pts / ${reb} reb / ${ast} ast)`,
        impactWeight: 88,
        metadata: { playerName: p.playerName, team: p.team, points: pts, rebounds: reb, assists: ast },
      });
      continue; // triple-double subsumes individual checks
    }

    if (pts >= 40) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} drops ${pts} points`,
        impactWeight: 93,
        metadata: { playerName: p.playerName, team: p.team, points: pts },
      });
    } else if (pts >= 30) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} scores ${pts} points`,
        impactWeight: 78,
        metadata: { playerName: p.playerName, team: p.team, points: pts },
      });
    }

    if (reb >= 15) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} pulls down ${reb} rebounds`,
        impactWeight: 76,
        metadata: { playerName: p.playerName, team: p.team, rebounds: reb },
      });
    }

    if (ast >= 15) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} dishes ${ast} assists`,
        impactWeight: 79,
        metadata: { playerName: p.playerName, team: p.team, assists: ast },
      });
    }
  }

  return events;
}

// ─── Standout-stat extraction — NFL ──────────────────────

function extractNFLStandouts(playerStats: PlayerStat[]): SalientEvent[] {
  const events: SalientEvent[] = [];

  for (const p of playerStats) {
    const passYards =
      typeof p.rawStats?.passingYards === "number" ? p.rawStats.passingYards : 0;
    const passTDs =
      typeof p.rawStats?.passingTouchdowns === "number" ? p.rawStats.passingTouchdowns : 0;
    const rushYards = p.yards ?? 0;
    const rushTDs = p.touchdowns ?? 0;

    if (passYards >= 400) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} throws for ${passYards} passing yards`,
        impactWeight: 86,
        metadata: { playerName: p.playerName, team: p.team, passingYards: passYards },
      });
    } else if (passYards >= 300) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} throws for ${passYards} passing yards`,
        impactWeight: 73,
        metadata: { playerName: p.playerName, team: p.team, passingYards: passYards },
      });
    }

    if (passTDs >= 4) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} throws ${passTDs} touchdown passes`,
        impactWeight: 86,
        metadata: { playerName: p.playerName, team: p.team, touchdownPasses: passTDs },
      });
    } else if (passTDs >= 3) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} throws ${passTDs} touchdown passes`,
        impactWeight: 79,
        metadata: { playerName: p.playerName, team: p.team, touchdownPasses: passTDs },
      });
    }

    if (rushYards >= 100) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} rushes for ${rushYards} yards`,
        impactWeight: rushTDs >= 2 ? 81 : 69,
        metadata: { playerName: p.playerName, team: p.team, rushingYards: rushYards, touchdowns: rushTDs },
      });
    } else if (rushTDs >= 2) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} scores ${rushTDs} rushing touchdowns`,
        impactWeight: 73,
        metadata: { playerName: p.playerName, team: p.team, touchdowns: rushTDs },
      });
    }
  }

  return events;
}

// ─── Standout-stat extraction — MLB ──────────────────────

function extractMLBStandouts(
  batters: MLBBatterStat[],
  pitchers: MLBPitcherStat[],
): SalientEvent[] {
  const events: SalientEvent[] = [];

  for (const b of batters) {
    const hr = b.homeRuns ?? 0;
    const rbi = b.rbi ?? 0;

    if (hr >= 2) {
      events.push({
        type: "standout-stat",
        description: `${b.playerName} hits ${hr} home runs`,
        impactWeight: 89,
        metadata: { playerName: b.playerName, team: b.team, homeRuns: hr, rbi },
      });
    } else if (hr >= 1) {
      events.push({
        type: "standout-stat",
        description: `${b.playerName} hits a home run`,
        impactWeight: 66,
        metadata: { playerName: b.playerName, team: b.team, homeRuns: hr, rbi },
      });
    }

    // Avoid double-counting when HR already covers it
    if (hr === 0 && rbi >= 4) {
      events.push({
        type: "standout-stat",
        description: `${b.playerName} drives in ${rbi} runs`,
        impactWeight: 83,
        metadata: { playerName: b.playerName, team: b.team, rbi },
      });
    } else if (hr === 0 && rbi >= 3) {
      events.push({
        type: "standout-stat",
        description: `${b.playerName} drives in ${rbi} runs`,
        impactWeight: 71,
        metadata: { playerName: b.playerName, team: b.team, rbi },
      });
    }
  }

  for (const p of pitchers) {
    const ks = p.strikeOuts ?? 0;
    const ip = parseFloat(p.inningsPitched ?? "0");

    if (ip >= 9) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} throws a complete game${ks >= 8 ? ` (${ks} K)` : ""}`,
        impactWeight: 89,
        metadata: { playerName: p.playerName, team: p.team, inningsPitched: ip, strikeouts: ks },
      });
    } else if (ks >= 10) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} strikes out ${ks} batters`,
        impactWeight: 83,
        metadata: { playerName: p.playerName, team: p.team, strikeouts: ks },
      });
    } else if (ks >= 8) {
      events.push({
        type: "standout-stat",
        description: `${p.playerName} strikes out ${ks} batters`,
        impactWeight: 73,
        metadata: { playerName: p.playerName, team: p.team, strikeouts: ks },
      });
    }
  }

  return events;
}

// ─── Key-play extraction ──────────────────────────────────

function extractKeyPlays(
  plays: PlayEntry[],
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
): SalientEvent[] {
  const events: SalientEvent[] = [];
  const seenIndices = new Set<number>();

  // Tier-1 plays are pre-flagged as high-impact by the data pipeline
  for (const play of plays) {
    if (play.tier !== 1 || !play.description) continue;
    seenIndices.add(play.playIndex);
    events.push({
      type: "key-play",
      description: play.description,
      impactWeight: 81,
      metadata: {
        eventId: play.eventId,
        period: play.quarter,
        gameClock: play.gameClock,
        homeScore: play.homeScore,
        awayScore: play.awayScore,
      },
    });
  }

  // Game-winning final scoring play in a close game (margin ≤ 5)
  const margin = Math.abs(homeScore - awayScore);
  if (margin <= 5) {
    const lastScore = [...plays].reverse().find((p) => p.scoreChanged);
    if (lastScore && !seenIndices.has(lastScore.playIndex)) {
      const winner = homeScore > awayScore ? homeTeam : awayTeam;
      events.push({
        type: "key-play",
        description: `${winner} scores the decisive ${lastScore.pointsScored ?? "basket"} to finish ${homeScore}–${awayScore}`,
        impactWeight: 96,
        metadata: {
          playIndex: lastScore.playIndex,
          homeScore,
          awayScore,
        },
      });
    }
  }

  return events;
}

// ─── Narrative classifier ─────────────────────────────────

function classifyNarrative(
  sport: string,
  homeScore: number,
  awayScore: number,
  plays: PlayEntry[],
): NarrativeType {
  const s = upper(sport);
  const margin = Math.abs(homeScore - awayScore);
  const total = homeScore + awayScore;
  const winner: "home" | "away" = homeScore >= awayScore ? "home" : "away";

  let leadChanges = 0;
  let maxWinnerDeficit = 0;
  let prevLeader: "home" | "away" | null = null;

  for (const play of plays) {
    if (!play.scoreChanged) continue;
    const h = play.homeScore ?? 0;
    const a = play.awayScore ?? 0;

    // Track the largest deficit the eventual winner had to overcome
    const winnerDeficit = winner === "home" ? a - h : h - a;
    if (winnerDeficit > maxWinnerDeficit) maxWinnerDeficit = winnerDeficit;

    let leader: "home" | "away" | null = null;
    if (h > a) leader = "home";
    else if (a > h) leader = "away";

    if (leader !== null && prevLeader !== null && leader !== prevLeader) leadChanges++;
    if (leader !== null) prevLeader = leader;
  }

  if (s === "NBA") {
    if (total < 185) return "defensive";
    if (margin >= 20) return "blowout";
    if (maxWinnerDeficit >= 15) return "comeback";
    if (leadChanges >= 6) return "back-and-forth";
    if (margin >= 10) return "dominant";
    return "back-and-forth";
  }

  if (s === "NFL") {
    if (total <= 27) return "defensive";
    if (margin >= 17) return "blowout";
    if (maxWinnerDeficit >= 14) return "comeback";
    if (leadChanges >= 4) return "back-and-forth";
    if (margin >= 10) return "dominant";
    return "back-and-forth";
  }

  if (s === "MLB") {
    if (total <= 4) return "defensive";
    if (margin >= 5) return "blowout";
    if (maxWinnerDeficit >= 3) return "comeback";
    if (leadChanges >= 4) return "back-and-forth";
    if (margin >= 3) return "dominant";
    return "back-and-forth";
  }

  // Generic fallback for other sports
  if (margin >= 15) return "blowout";
  if (maxWinnerDeficit >= 10) return "comeback";
  if (leadChanges >= 4) return "back-and-forth";
  if (margin >= 7) return "dominant";
  return "back-and-forth";
}

// ─── Main pipeline ────────────────────────────────────────

/**
 * Deterministic salient-event extraction from a structured box score.
 * Returns ≤15 events ranked by impact weight and a single narrative type.
 * No LLM call — feeds ISSUE-035 slot-filled prompt templates.
 */
export function extractSalientEvents(input: BoxScoreInput): SalientEventResult {
  const {
    sport,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    plays = [],
    playerStats = [],
    mlbBatters = [],
    mlbPitchers = [],
  } = input;

  const s = upper(sport);
  const all: SalientEvent[] = [];

  all.push(...extractLeadChanges(plays, homeTeam, awayTeam));
  all.push(...extractScoringRuns(plays, sport, homeTeam, awayTeam));
  all.push(...extractKeyPlays(plays, homeTeam, awayTeam, homeScore, awayScore));

  if (s === "NBA") {
    all.push(...extractNBAStandouts(playerStats));
  } else if (s === "NFL") {
    all.push(...extractNFLStandouts(playerStats));
  } else if (s === "MLB") {
    all.push(...extractMLBStandouts(mlbBatters, mlbPitchers));
  }

  const events = all.sort((a, b) => b.impactWeight - a.impactWeight).slice(0, 15);
  const narrativeType = classifyNarrative(sport, homeScore, awayScore, plays);

  return { events, narrativeType };
}
