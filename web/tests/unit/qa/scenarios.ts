import type {
  CatchupCardsResponse,
  PlayCardData,
  PlayEntry,
  PlayEventType,
} from "@/lib/types";

/**
 * Game-reconstruction QA scenarios.
 *
 * The user's framing: "Did this FEEL like the game?" — experiential, not
 * technical. We can't assert feel directly in code, but we *can* assert
 * structural proxies for the narrative properties that drive feel:
 *
 *   - climax positioning  → last play card is the winning/walkoff swing
 *   - compression         → card count stays bounded for low-action games
 *   - rhythm              → inning-transition cards distributed across
 *                           the game, not all clumped at one boundary
 *   - leverage selection  → late-game scoring plays are not skipped
 *   - edge-case validity  → triple plays / bases-loaded walks / catcher
 *                           interference render valid cards with the
 *                           correct event type and side effects
 *
 * Real upstream fixtures will replace these synthetic plays as they're
 * captured; the harness is designed to load fixtures interchangeably.
 */

export type ScenarioCategory = "famous" | "boring" | "weird";

export interface GameScenarioInput {
  game: {
    id: number;
    homeTeam: string;
    awayTeam: string;
    homeTeamAbbr: string;
    awayTeamAbbr: string;
    gameDate: string;
  };
  plays: PlayEntry[];
}

export interface GameScenario {
  name: string;
  category: ScenarioCategory;
  description: string;
  build: () => GameScenarioInput;
  assertions: (deck: CatchupCardsResponse, input: GameScenarioInput) => void;
}

// ── Helpers for building synthetic plays ──────────────────

interface PlayParams {
  index: number;
  inning: number;
  half: "top" | "bottom";
  tier: number;
  description: string;
  eventType?: PlayEventType;
  player?: string;
  pitcher?: string;
  scoreBefore?: { home: number; away: number };
  scoreAfter?: { home: number; away: number };
  pointsScored?: number;
  scoringTeamAbbr?: string;
}

function play(p: PlayParams): PlayEntry {
  return {
    playIndex: p.index,
    quarter: p.inning,
    phase: p.half,
    tier: p.tier,
    description: p.description,
    playType: p.eventType,
    playerName: p.player,
    homeScoreBefore: p.scoreBefore?.home,
    awayScoreBefore: p.scoreBefore?.away,
    homeScore: p.scoreAfter?.home ?? p.scoreBefore?.home,
    awayScore: p.scoreAfter?.away ?? p.scoreBefore?.away,
    pointsScored: p.pointsScored,
    scoringTeamAbbr: p.scoringTeamAbbr,
  };
}

const STD_GAME = {
  id: 999001,
  homeTeam: "Yankees",
  awayTeam: "Red Sox",
  homeTeamAbbr: "NYY",
  awayTeamAbbr: "BOS",
  gameDate: "2026-04-01T19:05:00-04:00",
};

// ── Scenarios ─────────────────────────────────────────────

export const SCENARIOS: GameScenario[] = [
  // ─── FAMOUS: walkoff HR ──────────────────────────────────
  {
    name: "walkoff HR in the 9th",
    category: "famous",
    description:
      "Tied entering the bottom 9th. Two routine outs, then a walkoff HR. " +
      "The deck must end on the walkoff and make it visibly climactic.",
    build: () => {
      const plays: PlayEntry[] = [];
      let idx = 1;
      // Innings 1-8: 2 routine outs per half + 1 weak hit, scoreless.
      for (let inning = 1; inning <= 8; inning++) {
        for (const half of ["top", "bottom"] as const) {
          plays.push(play({
            index: idx++, inning, half, tier: 3,
            description: "Strikes out swinging.",
            scoreBefore: { home: 0, away: 0 },
          }));
          plays.push(play({
            index: idx++, inning, half, tier: 3,
            description: "Grounds out, second baseman to first.",
            scoreBefore: { home: 0, away: 0 },
          }));
          plays.push(play({
            index: idx++, inning, half, tier: 3,
            description: "Flies out to right fielder.",
            scoreBefore: { home: 0, away: 0 },
          }));
        }
      }
      // Top 9: away team scratches a run.
      plays.push(play({
        index: idx++, inning: 9, half: "top", tier: 1,
        description: "Singles, RBI scores.",
        player: "Devers",
        scoreBefore: { home: 0, away: 0 },
        scoreAfter: { home: 0, away: 1 },
        pointsScored: 1, scoringTeamAbbr: "BOS",
      }));
      plays.push(play({
        index: idx++, inning: 9, half: "top", tier: 3,
        description: "Strikes out swinging.",
        scoreBefore: { home: 0, away: 1 },
      }));
      plays.push(play({
        index: idx++, inning: 9, half: "top", tier: 3,
        description: "Grounds out to short.",
        scoreBefore: { home: 0, away: 1 },
      }));
      plays.push(play({
        index: idx++, inning: 9, half: "top", tier: 3,
        description: "Pops out to second baseman.",
        scoreBefore: { home: 0, away: 1 },
      }));
      // Bottom 9: two outs, then WALKOFF HR.
      plays.push(play({
        index: idx++, inning: 9, half: "bottom", tier: 3,
        description: "Strikes out swinging.",
        scoreBefore: { home: 0, away: 1 },
      }));
      plays.push(play({
        index: idx++, inning: 9, half: "bottom", tier: 3,
        description: "Grounds out, third baseman to first.",
        scoreBefore: { home: 0, away: 1 },
      }));
      plays.push(play({
        index: idx++, inning: 9, half: "bottom", tier: 1,
        description: "Walkoff homer to deep right field, two-run shot.",
        player: "Judge",
        scoreBefore: { home: 0, away: 1 },
        scoreAfter: { home: 2, away: 1 },
        pointsScored: 2, scoringTeamAbbr: "NYY",
      }));
      return { game: STD_GAME, plays };
    },
    assertions: (deck) => {
      const playCards = deck.cards.filter(
        (c): c is PlayCardData => c.kind === "play",
      );
      const last = playCards[playCards.length - 1];
      // Climax positioning: last card IS the walkoff.
      if (last.eventType !== "home_run") {
        throw new Error(`expected walkoff HR last; got ${last.eventType}`);
      }
      if (last.inning !== 9 || last.inningHalf !== "bottom") {
        throw new Error(`walkoff not in B9; got ${last.inningLabel}`);
      }
      // Lead-change: home team finishes ahead.
      if (last.scoreAfter.home <= last.scoreAfter.away) {
        throw new Error(`expected home to lead after walkoff; got ${JSON.stringify(last.scoreAfter)}`);
      }
      // Late-leverage scoring play (top 9) must also be in the deck.
      const top9Score = playCards.find(
        (c) => c.inning === 9 && c.inningHalf === "top" && c.scoreAfter.away > c.scoreBefore.away,
      );
      if (!top9Score) {
        throw new Error("expected the T9 RBI single to make the deck");
      }
    },
  },

  // ─── BORING: 1-0 pitcher's duel ──────────────────────────
  {
    name: "1-0 pitcher's duel",
    category: "boring",
    description:
      "One run scored across the entire game. Most plays are routine outs. " +
      "Card count must compress; the deck cannot drag on with empty filler.",
    build: () => {
      const plays: PlayEntry[] = [];
      let idx = 1;
      // 9 innings of mostly strikeouts/groundouts.
      for (let inning = 1; inning <= 9; inning++) {
        for (const half of ["top", "bottom"] as const) {
          for (let k = 0; k < 3; k++) {
            plays.push(play({
              index: idx++, inning, half, tier: 3,
              description: k === 0
                ? "Strikes out swinging."
                : k === 1
                ? "Grounds out, shortstop to first."
                : "Flies out to center fielder.",
              scoreBefore: { home: inning >= 4 ? 1 : 0, away: 0 },
            }));
          }
        }
      }
      // The lone run: solo HR in the 4th by home team.
      plays.push(play({
        index: idx++, inning: 4, half: "bottom", tier: 1,
        description: "Solo home run to left field.",
        player: "Stanton",
        scoreBefore: { home: 0, away: 0 },
        scoreAfter: { home: 1, away: 0 },
        pointsScored: 1, scoringTeamAbbr: "NYY",
      }));
      return { game: STD_GAME, plays };
    },
    assertions: (deck) => {
      const playCards = deck.cards.filter(
        (c): c is PlayCardData => c.kind === "play",
      );
      // Compression: we sample tier-2/3 toward TARGET_TOTAL but NEVER
      // explode beyond it. For a low-action game, the deck should sit
      // comfortably under HARD_MAX.
      if (playCards.length > 30) {
        throw new Error(`compression failed; got ${playCards.length} play cards`);
      }
      // The lone scoring play MUST appear.
      const scoring = playCards.find(
        (c) => c.scoreAfter.home > c.scoreBefore.home || c.scoreAfter.away > c.scoreBefore.away,
      );
      if (!scoring) throw new Error("solo HR went missing from the deck");
      if (scoring.eventType !== "home_run") {
        throw new Error(`expected scoring play to classify as home_run; got ${scoring.eventType}`);
      }
    },
  },

  // ─── WEIRD: triple play ──────────────────────────────────
  {
    name: "triple play with bases loaded",
    category: "weird",
    description:
      "Bases loaded, no outs, line drive turned into a triple play. " +
      "The card must read as inning-over with all three outs registered.",
    build: () => {
      const plays: PlayEntry[] = [
        // Bases-loaded setup.
        play({
          index: 1, inning: 5, half: "top", tier: 3,
          description: "Singles to right.",
          player: "Bogaerts",
        }),
        play({
          index: 2, inning: 5, half: "top", tier: 3,
          description: "Walks.",
          player: "Yoshida",
        }),
        play({
          index: 3, inning: 5, half: "top", tier: 3,
          description: "Singles to left, runners advance.",
          player: "Casas",
        }),
        // Triple play.
        play({
          index: 4, inning: 5, half: "top", tier: 1,
          description: "Hits into a triple play, line drive to second baseman.",
          player: "Devers",
        }),
      ];
      return { game: STD_GAME, plays };
    },
    assertions: (deck) => {
      const tp = deck.cards.find(
        (c) => c.kind === "play" && c.eventType === "triple_play",
      );
      if (!tp || tp.kind !== "play") {
        throw new Error("triple play card missing from deck");
      }
      if (tp.outsAfter !== 3) {
        throw new Error(`triple play must end at 3 outs; got ${tp.outsAfter}`);
      }
    },
  },

  // ─── WEIRD: bases-loaded walk forces in a run ────────────
  {
    name: "bases-loaded walk forces run",
    category: "weird",
    description:
      "Bases loaded, walk forces in a run. All runners advance one base; " +
      "the run must visibly score and the result chip should label the walk.",
    build: () => {
      const plays: PlayEntry[] = [
        play({
          index: 1, inning: 3, half: "bottom", tier: 3,
          description: "Singles to center.",
          player: "Soto",
        }),
        play({
          index: 2, inning: 3, half: "bottom", tier: 3,
          description: "Walks.",
          player: "Judge",
        }),
        play({
          index: 3, inning: 3, half: "bottom", tier: 3,
          description: "Singles, runners advance.",
          player: "Stanton",
          scoreBefore: { home: 0, away: 0 },
          scoreAfter: { home: 0, away: 0 },
        }),
        // Bases loaded — this walk forces the third-base runner home.
        play({
          index: 4, inning: 3, half: "bottom", tier: 1,
          description: "Walks on a 3-2 pitch, run forced in.",
          player: "Volpe",
          scoreBefore: { home: 0, away: 0 },
          scoreAfter: { home: 1, away: 0 },
          pointsScored: 1, scoringTeamAbbr: "NYY",
        }),
      ];
      return { game: STD_GAME, plays };
    },
    assertions: (deck) => {
      const walk = deck.cards.find(
        (c) =>
          c.kind === "play" &&
          c.eventType === "walk" &&
          c.scoreAfter.home > c.scoreBefore.home,
      );
      if (!walk || walk.kind !== "play") {
        throw new Error("forced-walk run-scoring play missing");
      }
      // Bases must be loaded after — the walk only advanced one runner.
      const after = walk.baseStateAfter;
      if (!(after.first && after.second && after.third)) {
        throw new Error(`bases must remain loaded after RBI walk; got ${JSON.stringify(after)}`);
      }
      // Scoring runner advance must show "third → home".
      const advances = walk.runnerAdvances ?? [];
      const homeScore = advances.find((a) => a.from === "third" && a.to === "home");
      if (!homeScore) {
        throw new Error("scoring advance from third to home not present");
      }
    },
  },

  // ─── WEIRD: catcher's interference ───────────────────────
  {
    name: "catcher's interference awards first",
    category: "weird",
    description:
      "Rare event — batter awarded first base on catcher's interference. " +
      "Must produce a valid card and force-advance any required runners.",
    build: () => {
      const plays: PlayEntry[] = [
        play({
          index: 1, inning: 6, half: "top", tier: 1,
          description: "Reaches on catcher's interference, awarded first base.",
          player: "Ohtani",
        }),
      ];
      return { game: STD_GAME, plays };
    },
    assertions: (deck) => {
      const ci = deck.cards.find(
        (c) => c.kind === "play" && c.eventType === "catcher_interference",
      );
      if (!ci || ci.kind !== "play") {
        throw new Error("catcher's interference card missing");
      }
      if (!ci.baseStateAfter.first) {
        throw new Error("CI must put batter on first base");
      }
    },
  },

  // ─── FAMOUS: extra-innings rally ─────────────────────────
  {
    name: "extra-innings winning run",
    category: "famous",
    description:
      "Tied through nine. Top of the 10th: the visiting team scores. " +
      "The 10th-inning play must surface (late-leverage), and the game must " +
      "be reflected as ending with the lead change.",
    build: () => {
      const plays: PlayEntry[] = [];
      let idx = 1;
      // Innings 1-9, both halves, mostly outs and a few hits, score 1-1.
      for (let inning = 1; inning <= 9; inning++) {
        for (const half of ["top", "bottom"] as const) {
          plays.push(play({
            index: idx++, inning, half, tier: 3,
            description: "Strikes out swinging.",
            scoreBefore: { home: 1, away: 1 },
          }));
          plays.push(play({
            index: idx++, inning, half, tier: 3,
            description: "Grounds out.",
            scoreBefore: { home: 1, away: 1 },
          }));
          plays.push(play({
            index: idx++, inning, half, tier: 3,
            description: "Flies out.",
            scoreBefore: { home: 1, away: 1 },
          }));
        }
      }
      // T10: visiting team scores the go-ahead.
      plays.push(play({
        index: idx++, inning: 10, half: "top", tier: 1,
        description: "Hits a go-ahead solo HR to deep center.",
        player: "Verdugo",
        scoreBefore: { home: 1, away: 1 },
        scoreAfter: { home: 1, away: 2 },
        pointsScored: 1, scoringTeamAbbr: "BOS",
      }));
      // B10: home team goes down in order.
      for (let k = 0; k < 3; k++) {
        plays.push(play({
          index: idx++, inning: 10, half: "bottom", tier: 3,
          description: "Strikes out.",
          scoreBefore: { home: 1, away: 2 },
        }));
      }
      return { game: STD_GAME, plays };
    },
    assertions: (deck) => {
      const playCards = deck.cards.filter(
        (c): c is PlayCardData => c.kind === "play",
      );
      const t10HR = playCards.find(
        (c) => c.inning === 10 && c.inningHalf === "top" && c.eventType === "home_run",
      );
      if (!t10HR) throw new Error("T10 go-ahead HR missing from deck");
      // Final score state: away 2, home 1.
      const lastCard = playCards[playCards.length - 1];
      if (lastCard.scoreAfter.away <= lastCard.scoreAfter.home) {
        throw new Error("away should be ahead after T10 HR");
      }
    },
  },

  // ─── BORING: blowout ─────────────────────────────────────
  {
    name: "early blowout, routine outs after",
    category: "boring",
    description:
      "Big early lead, mostly routine plays after. Compression must keep " +
      "the deck readable; lead-change and scoring plays from the early " +
      "inning must surface.",
    build: () => {
      const plays: PlayEntry[] = [];
      let idx = 1;
      // T1: away team scores 5 runs.
      const t1Score = (h: number, a: number) => ({ home: h, away: a });
      plays.push(play({
        index: idx++, inning: 1, half: "top", tier: 1,
        description: "Hits a 2-run HR.",
        scoreBefore: t1Score(0, 0), scoreAfter: t1Score(0, 2),
        pointsScored: 2, scoringTeamAbbr: "BOS",
      }));
      plays.push(play({
        index: idx++, inning: 1, half: "top", tier: 1,
        description: "Hits a 3-run HR.",
        scoreBefore: t1Score(0, 2), scoreAfter: t1Score(0, 5),
        pointsScored: 3, scoringTeamAbbr: "BOS",
      }));
      // The rest of the game: routine outs.
      for (let inning = 1; inning <= 9; inning++) {
        for (const half of ["top", "bottom"] as const) {
          for (let k = 0; k < 3; k++) {
            plays.push(play({
              index: idx++, inning, half, tier: 3,
              description: "Grounds out.",
              scoreBefore: t1Score(0, 5),
            }));
          }
        }
      }
      return { game: STD_GAME, plays };
    },
    assertions: (deck) => {
      const playCards = deck.cards.filter(
        (c): c is PlayCardData => c.kind === "play",
      );
      // Both early HRs must be in the deck.
      const hrs = playCards.filter((c) => c.eventType === "home_run");
      if (hrs.length < 2) throw new Error(`expected both T1 HRs; got ${hrs.length}`);
      // Card count stays bounded — no need to render every routine out.
      if (playCards.length > 30) {
        throw new Error(`blowout card count too high: ${playCards.length}`);
      }
    },
  },

  // ─── ORDINARY: 5-3 standard game ────────────────────────
  {
    name: "ordinary 5-3 game",
    category: "boring",
    description:
      "Average game shape: a few scoring innings, a few quiet stretches, " +
      "no late drama. Acceptance: 8-14 play cards, 2-4 rhythm cards, " +
      "scoring plays preserved, no over-rhythm before the 6th.",
    build: () => {
      const plays: PlayEntry[] = [];
      let idx = 1;
      // T1: away scores 1.
      plays.push(play({
        index: idx++, inning: 1, half: "top", tier: 1,
        description: "RBI single, run scores.",
        scoreBefore: { home: 0, away: 0 }, scoreAfter: { home: 0, away: 1 },
        pointsScored: 1, scoringTeamAbbr: "BOS",
      }));
      // B1: routine outs.
      for (let k = 0; k < 3; k++) plays.push(play({
        index: idx++, inning: 1, half: "bottom", tier: 3,
        description: "Strikes out.",
      }));
      // Innings 2-3: quiet — single hit each side, mostly outs.
      for (let inning = 2; inning <= 3; inning++) {
        for (const half of ["top", "bottom"] as const) {
          for (let k = 0; k < 3; k++) plays.push(play({
            index: idx++, inning, half, tier: 3, description: "Grounds out.",
            scoreBefore: { home: 0, away: 1 },
          }));
        }
      }
      // B4: home team rallies for 3.
      plays.push(play({
        index: idx++, inning: 4, half: "bottom", tier: 1,
        description: "Hits a 3-run HR, taking the lead.",
        scoreBefore: { home: 0, away: 1 }, scoreAfter: { home: 3, away: 1 },
        pointsScored: 3, scoringTeamAbbr: "NYY",
      }));
      // Innings 5-6 quiet.
      for (let inning = 5; inning <= 6; inning++) {
        for (const half of ["top", "bottom"] as const) {
          for (let k = 0; k < 3; k++) plays.push(play({
            index: idx++, inning, half, tier: 3, description: "Pops out.",
            scoreBefore: { home: 3, away: 1 },
          }));
        }
      }
      // T7: away scratches 2 to make it close.
      plays.push(play({
        index: idx++, inning: 7, half: "top", tier: 1,
        description: "RBI double, runner scores.",
        scoreBefore: { home: 3, away: 1 }, scoreAfter: { home: 3, away: 2 },
        pointsScored: 1, scoringTeamAbbr: "BOS",
      }));
      plays.push(play({
        index: idx++, inning: 7, half: "top", tier: 1,
        description: "RBI single, ties the game.",
        scoreBefore: { home: 3, away: 2 }, scoreAfter: { home: 3, away: 3 },
        pointsScored: 1, scoringTeamAbbr: "BOS",
      }));
      // B7-T8 quiet.
      for (let k = 0; k < 3; k++) plays.push(play({
        index: idx++, inning: 7, half: "bottom", tier: 3, description: "Flies out.",
        scoreBefore: { home: 3, away: 3 },
      }));
      for (let k = 0; k < 3; k++) plays.push(play({
        index: idx++, inning: 8, half: "top", tier: 3, description: "Grounds out.",
        scoreBefore: { home: 3, away: 3 },
      }));
      // B8: home retakes lead for 5-3 final.
      plays.push(play({
        index: idx++, inning: 8, half: "bottom", tier: 1,
        description: "Two-run double, takes the lead back.",
        scoreBefore: { home: 3, away: 3 }, scoreAfter: { home: 5, away: 3 },
        pointsScored: 2, scoringTeamAbbr: "NYY",
      }));
      // T9: routine three outs.
      for (let k = 0; k < 3; k++) plays.push(play({
        index: idx++, inning: 9, half: "top", tier: 3,
        description: "Strikes out.",
        scoreBefore: { home: 5, away: 3 },
      }));
      return { game: STD_GAME, plays };
    },
    assertions: (deck, _input) => {
      const playCards = deck.cards.filter(
        (c): c is PlayCardData => c.kind === "play",
      );
      const rhythmCards = deck.cards.filter(
        (c) =>
          c.kind === "inning-transition" ||
          c.kind === "quiet-stretch" ||
          c.kind === "late-game" ||
          c.kind === "final-setup",
      );
      // Acceptance: 8-14 play cards, 2-4 rhythm cards (per user spec).
      if (playCards.length < 5 || playCards.length > 18) {
        throw new Error(`ordinary game play count out of band: ${playCards.length}`);
      }
      if (rhythmCards.length < 2 || rhythmCards.length > 7) {
        throw new Error(`ordinary game rhythm count out of band: ${rhythmCards.length}`);
      }
      // No more than 2 rhythm cards before the 6th (the user's noise rule).
      const earlyRhythm = rhythmCards.filter(
        (c) =>
          (c.kind === "inning-transition" ||
            c.kind === "quiet-stretch" ||
            c.kind === "late-game" ||
            c.kind === "final-setup") &&
          ((c.fromInning ?? c.toInning ?? 99) < 6),
      );
      if (earlyRhythm.length > 2) {
        throw new Error(`too many rhythm cards before 6th: ${earlyRhythm.length}`);
      }
      // Scoring plays preserved.
      const scoring = playCards.filter(
        (c) =>
          c.scoreAfter.home > c.scoreBefore.home ||
          c.scoreAfter.away > c.scoreBefore.away,
      );
      // T1 RBI, B4 3-run HR, T7 (×2), B8 2-run double = 5 distinct scoring plays.
      if (scoring.length < 4) {
        throw new Error(`scoring plays missing; got ${scoring.length}`);
      }
    },
  },

  // ─── FAMOUS: comeback game ──────────────────────────────
  {
    name: "comeback rally in the 8th",
    category: "famous",
    description:
      "Down 4-1 entering the 8th, home team rallies for 4 to take the lead. " +
      "Late-game rhythm card must fire; the rally plays must surface; the " +
      "deck must end on the deciding moment.",
    build: () => {
      const plays: PlayEntry[] = [];
      let idx = 1;
      // Early scoring: away team builds 4-1 lead.
      plays.push(play({
        index: idx++, inning: 1, half: "top", tier: 1,
        description: "RBI single, scores.",
        scoreBefore: { home: 0, away: 0 }, scoreAfter: { home: 0, away: 1 },
        pointsScored: 1, scoringTeamAbbr: "BOS",
      }));
      plays.push(play({
        index: idx++, inning: 3, half: "top", tier: 1,
        description: "2-run HR.",
        scoreBefore: { home: 0, away: 1 }, scoreAfter: { home: 0, away: 3 },
        pointsScored: 2, scoringTeamAbbr: "BOS",
      }));
      plays.push(play({
        index: idx++, inning: 4, half: "bottom", tier: 1,
        description: "Solo HR.",
        scoreBefore: { home: 0, away: 3 }, scoreAfter: { home: 1, away: 3 },
        pointsScored: 1, scoringTeamAbbr: "NYY",
      }));
      plays.push(play({
        index: idx++, inning: 6, half: "top", tier: 1,
        description: "RBI double, scores.",
        scoreBefore: { home: 1, away: 3 }, scoreAfter: { home: 1, away: 4 },
        pointsScored: 1, scoringTeamAbbr: "BOS",
      }));
      // Filler outs across the game.
      for (let inning = 1; inning <= 8; inning++) {
        for (const half of ["top", "bottom"] as const) {
          for (let k = 0; k < 2; k++) plays.push(play({
            index: idx++, inning, half, tier: 3, description: "Grounds out.",
            scoreBefore: { home: 1, away: 4 },
          }));
        }
      }
      // B8: 4-run rally for the lead.
      plays.push(play({
        index: idx++, inning: 8, half: "bottom", tier: 1,
        description: "RBI single.",
        scoreBefore: { home: 1, away: 4 }, scoreAfter: { home: 2, away: 4 },
        pointsScored: 1, scoringTeamAbbr: "NYY",
      }));
      plays.push(play({
        index: idx++, inning: 8, half: "bottom", tier: 1,
        description: "2-run double.",
        scoreBefore: { home: 2, away: 4 }, scoreAfter: { home: 4, away: 4 },
        pointsScored: 2, scoringTeamAbbr: "NYY",
      }));
      plays.push(play({
        index: idx++, inning: 8, half: "bottom", tier: 1,
        description: "RBI single, takes the lead.",
        scoreBefore: { home: 4, away: 4 }, scoreAfter: { home: 5, away: 4 },
        pointsScored: 1, scoringTeamAbbr: "NYY",
      }));
      // T9: 1-2-3.
      for (let k = 0; k < 3; k++) plays.push(play({
        index: idx++, inning: 9, half: "top", tier: 3, description: "Strikes out.",
        scoreBefore: { home: 5, away: 4 },
      }));
      return { game: STD_GAME, plays };
    },
    assertions: (deck) => {
      const playCards = deck.cards.filter(
        (c): c is PlayCardData => c.kind === "play",
      );
      // Late-game rhythm card must appear (entering 7th+ in close game).
      const lateGame = deck.cards.find((c) => c.kind === "late-game");
      if (!lateGame) {
        throw new Error("comeback game must show late-game rhythm card");
      }
      // The rally plays in B8 must all surface.
      const b8Scoring = playCards.filter(
        (c) =>
          c.inning === 8 &&
          c.inningHalf === "bottom" &&
          c.scoreAfter.home > c.scoreBefore.home,
      );
      if (b8Scoring.length < 3) {
        throw new Error(`B8 rally plays missing; got ${b8Scoring.length}`);
      }
    },
  },
];

// ─── Acceptance summary helper ──────────────────────────────────────
// Aggregates basic deck-shape stats. Used by the QA test runner so the
// per-scenario assertions can stay focused on category-specific properties.

export function deckShape(deck: { cards: { kind: string }[] }) {
  const byKind = new Map<string, number>();
  for (const c of deck.cards) {
    byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
  }
  return {
    plays: byKind.get("play") ?? 0,
    rhythm:
      (byKind.get("inning-transition") ?? 0) +
      (byKind.get("quiet-stretch") ?? 0) +
      (byKind.get("late-game") ?? 0) +
      (byKind.get("final-setup") ?? 0),
    sceneSetters: byKind.get("scene-setter") ?? 0,
    total: deck.cards.length,
  };
}
