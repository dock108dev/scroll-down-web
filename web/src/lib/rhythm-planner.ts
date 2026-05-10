import type {
  CatchupCard,
  InningTransitionCard,
  PlayCardData,
  PriorAfterState,
  RhythmCard,
  SceneSetterCard,
} from "./types";

/**
 * Rhythm planner. Owns pacing decisions for the catch-up deck.
 *
 * The card builder is responsible only for selecting *which* plays show
 * up; the planner is responsible for *how* the deck breathes.
 *
 * Pacing kinds inserted between play cards:
 *
 *   - inning-transition: between two displayed plays in different halves,
 *     ONLY if the previous half was MEANINGFUL — see the meaningfulness
 *     rule below. Single 1-run halves are deliberately suppressed in
 *     non-leverage contexts so the deck doesn't dribble out a transition
 *     after every solo HR.
 *   - quiet-stretch:    when 3+ half-innings pass with no displayed
 *                       plays. Compresses the dead air into one beat.
 *   - late-game:        the first time we cross into the 7th in a game
 *                       within 4 runs. Marks the pressure phase.
 *   - final-setup:      before the last play card when stakes are real
 *                       (9th+, ≤ 2-run margin entering the play).
 *
 * Meaningfulness rule for inning-transition:
 *   A half-inning is "meaningful enough" to mark with a transition when
 *   ANY of the following holds:
 *     - it scored 2+ runs (a real cluster, not just a solo HR)
 *     - a lead change occurred during it (any score swing matters)
 *     - a tying run scored during it (the game state pivoted)
 *     - it was inning 7+ AND scored at least 1 run (late-game leverage)
 *
 * Rules are deliberately conservative — the user feels paced, not
 * interrupted. The renderer is dumb; all timing decisions live here.
 */

export interface HalfInningMeta {
  scoredRuns: number;
  hadActivity: boolean;
  hadLeadChange: boolean;
  hadTying: boolean;
}

export interface RhythmPlannerInput {
  /** Scene-setter when this is the initial fetch. Null on incremental
   *  polls so we don't re-emit the intro. */
  scene: SceneSetterCard | null;
  /** Selected play cards in playIndex order, already built. */
  playCards: PlayCardData[];
  /** "{inning}:{half}" → activity summary. Pre-computed by the caller
   *  from the timeline so the planner doesn't re-walk plays. */
  halfInningMeta: Map<string, HalfInningMeta>;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
}

/** Per-deck breakdown of why each rhythm card fired (or was skipped).
 *  Used by fixture-driven QA to assert that pacing decisions match the
 *  game's actual energy. */
export interface PlannerReport {
  rhythm: Array<{
    cardId: string;
    kind: "inning-transition" | "quiet-stretch" | "late-game" | "final-setup";
    /** Human-readable reason — used in test output for failures. */
    reason: string;
    /** Last displayed play before this rhythm beat. */
    afterPlayIndex?: number;
    /** First displayed play after this rhythm beat. */
    beforePlayIndex?: number;
  }>;
}

/**
 * Plan the final deck. Returns ordered cards plus a report explaining
 * each rhythm decision. The non-reporting `planDeck` is a thin wrapper
 * that throws away the report — useful for the production code path
 * which doesn't ship the report to the client.
 */
export function planDeckWithReport(
  input: RhythmPlannerInput,
): { deck: CatchupCard[]; report: PlannerReport } {
  const out: CatchupCard[] = [];
  const report: PlannerReport = { rhythm: [] };
  let nextIndex = 0;

  if (input.scene) {
    out.push({ ...input.scene, index: nextIndex++ });
  }

  const cards = input.playCards;
  let prevPlay: PlayCardData | null = null;
  let prevAfter: PriorAfterState | null = null;
  let lateGameEmitted = false;
  // Per-deck rhythm budget: limit how many of the low-energy quiet-stretch
  // cards we emit. In a sparse deck (boring 1-0 game with 3 dead spans)
  // emitting one per gap dominates the experience. Cap at 2 — the
  // remaining gaps just cross silently.
  const QUIET_STRETCH_BUDGET = 2;
  let quietStretchCount = 0;

  for (let i = 0; i < cards.length; i++) {
    const curr = cards[i];
    const isLast = i === cards.length - 1;

    const between = decideBetween(prevPlay, curr, input, lateGameEmitted);
    for (const { card, reason } of between) {
      // Skip quiet-stretches once the budget is exhausted. The user
      // still gets the natural compression (no card inserted), just
      // without a card calling attention to it.
      if (card.kind === "quiet-stretch") {
        if (quietStretchCount >= QUIET_STRETCH_BUDGET) continue;
        quietStretchCount++;
      }
      out.push({ ...card, index: nextIndex++ });
      report.rhythm.push({
        cardId: card.cardId,
        kind: card.kind,
        reason,
        afterPlayIndex: prevPlay?.playIndex,
        beforePlayIndex: curr.playIndex,
      });
      prevAfter = null;
      if (card.kind === "late-game") lateGameEmitted = true;
    }

    if (isLast) {
      const setup = maybeFinalSetup(prevPlay, curr, input);
      if (setup) {
        out.push({ ...setup.card, index: nextIndex++ });
        report.rhythm.push({
          cardId: setup.card.cardId,
          kind: setup.card.kind,
          reason: setup.reason,
          beforePlayIndex: curr.playIndex,
        });
        prevAfter = null;
      }
    }

    const cardCopy: PlayCardData = { ...curr, index: nextIndex++ };
    if (prevAfter) cardCopy.priorAfter = prevAfter;
    else delete cardCopy.priorAfter;
    out.push(cardCopy);

    prevPlay = curr;
    prevAfter = {
      score: curr.scoreAfter,
      baseState: curr.baseStateAfter,
      runnerNames: curr.runnerNamesAfter ?? {},
      outs: curr.outsAfter,
      inning: curr.inning,
      inningHalf: curr.inningHalf,
    };
  }

  return { deck: out, report };
}

export function planDeck(input: RhythmPlannerInput): CatchupCard[] {
  return planDeckWithReport(input).deck;
}

/**
 * Build the `halfInningMeta` map the planner needs. Caller passes
 * timeline entries — we avoid re-walking plays.
 */
export function summarizeHalfInnings(
  entries: Iterable<{
    inning: number;
    half: "top" | "bottom";
    runsScored: number;
    isLeadChangePlay: boolean;
    isTyingPlay: boolean;
  }>,
): Map<string, HalfInningMeta> {
  const map = new Map<string, HalfInningMeta>();
  for (const e of entries) {
    const key = `${e.inning}:${e.half}`;
    const existing =
      map.get(key) ??
      ({
        scoredRuns: 0,
        hadActivity: false,
        hadLeadChange: false,
        hadTying: false,
      } as HalfInningMeta);
    existing.scoredRuns += e.runsScored;
    existing.hadActivity = true;
    if (e.isLeadChangePlay) existing.hadLeadChange = true;
    if (e.isTyingPlay) existing.hadTying = true;
    map.set(key, existing);
  }
  return map;
}

// ── Rule selection ──────────────────────────────────────────

interface RhythmInsertion {
  card: InningTransitionCard | RhythmCard;
  reason: string;
}

function decideBetween(
  prev: PlayCardData | null,
  curr: PlayCardData,
  input: RhythmPlannerInput,
  lateGameEmitted: boolean,
): RhythmInsertion[] {
  if (!prev) return [];

  const prevHI = halfIndex(prev.inning, prev.inningHalf);
  const currHI = halfIndex(curr.inning, curr.inningHalf);
  const halfInningsSpanned = currHI - prevHI;
  if (halfInningsSpanned <= 0) return [];

  const out: RhythmInsertion[] = [];

  if (halfInningsSpanned >= 3) {
    out.push({
      card: buildQuietStretch(prev, curr, input),
      reason: `compressed ${halfInningsSpanned} silent half-innings`,
    });
  } else {
    const meta = input.halfInningMeta.get(`${prev.inning}:${prev.inningHalf}`);
    const decision = halfMeaningfulness(prev.inning, meta);
    if (decision.meaningful) {
      out.push({
        card: buildInningTransition(prev, curr, input),
        reason: decision.reason,
      });
    }
  }

  const margin = Math.abs(curr.scoreBefore.home - curr.scoreBefore.away);
  const enteringLate =
    !lateGameEmitted && prev.inning < 7 && curr.inning >= 7 && margin <= 4;
  if (enteringLate) {
    out.push({
      card: buildLateGame(curr, input),
      reason: `crossed into inning 7+ with margin ${margin}`,
    });
  }

  return out;
}

/** Apply the meaningfulness rule: a 1-run half by itself is suppressed
 *  unless it tied the game, swung the lead, or happened in inning 7+. */
function halfMeaningfulness(
  prevInning: number,
  meta: HalfInningMeta | undefined,
): { meaningful: boolean; reason: string } {
  if (!meta) return { meaningful: false, reason: "no activity" };
  if (meta.scoredRuns >= 2) {
    return { meaningful: true, reason: `${meta.scoredRuns} runs scored` };
  }
  if (meta.hadLeadChange) {
    return { meaningful: true, reason: "lead change" };
  }
  if (meta.hadTying) {
    return { meaningful: true, reason: "tying run" };
  }
  if (prevInning >= 7 && meta.scoredRuns >= 1) {
    return { meaningful: true, reason: "late-inning scoring" };
  }
  return {
    meaningful: false,
    reason:
      meta.scoredRuns === 1
        ? "single run, no leverage — suppressed"
        : "silent half — suppressed",
  };
}

function maybeFinalSetup(
  _prev: PlayCardData | null,
  curr: PlayCardData,
  input: RhythmPlannerInput,
): RhythmInsertion | null {
  if (curr.inning < 9) return null;
  const margin = Math.abs(curr.scoreBefore.home - curr.scoreBefore.away);
  if (margin > 2) return null;
  return {
    card: buildFinalSetup(curr, input),
    reason: `9th-inning final play with margin ${margin}`,
  };
}

// ── Helpers ─────────────────────────────────────────────────

function halfIndex(inning: number, half: "top" | "bottom"): number {
  return inning * 2 + (half === "bottom" ? 1 : 0);
}

function ordinal(n: number): string {
  const v = Math.abs(n);
  if (v % 100 >= 11 && v % 100 <= 13) return `${n}th`;
  switch (v % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function describeScoreState(
  score: { home: number; away: number },
  homeTeamAbbr: string,
  awayTeamAbbr: string,
): string {
  const diff = score.home - score.away;
  if (diff === 0) {
    if (score.home === 0) return "Still scoreless.";
    return `Tied at ${score.home}.`;
  }
  const leader = diff > 0 ? homeTeamAbbr : awayTeamAbbr;
  const margin = Math.abs(diff);
  if (margin === 1) return `${leader} lead by 1.`;
  return `${leader} lead by ${margin}.`;
}

// ── Card builders ───────────────────────────────────────────

function buildInningTransition(
  prev: PlayCardData,
  curr: PlayCardData,
  input: RhythmPlannerInput,
): InningTransitionCard {
  const phase: "end" | "mid" =
    prev.inningHalf === "bottom" || prev.inning < curr.inning ? "end" : "mid";
  const headInning = prev.inning;
  const label =
    phase === "end"
      ? `END ${ordinal(headInning).toUpperCase()}`
      : `MID ${ordinal(headInning).toUpperCase()}`;
  return {
    kind: "inning-transition",
    gameId: prev.gameId,
    cardId: `${prev.gameId}-tx-${prev.inning}-${prev.inningHalf}-${curr.inning}-${curr.inningHalf}`,
    index: 0,
    label,
    phase,
    score: prev.scoreAfter,
    homeTeamAbbr: input.homeTeamAbbr,
    awayTeamAbbr: input.awayTeamAbbr,
    subtitle: describeScoreState(prev.scoreAfter, input.homeTeamAbbr, input.awayTeamAbbr),
    fromInning: prev.inning,
    fromHalf: prev.inningHalf,
    toInning: curr.inning,
    toHalf: curr.inningHalf,
  };
}

function buildQuietStretch(
  prev: PlayCardData,
  curr: PlayCardData,
  input: RhythmPlannerInput,
): RhythmCard {
  const passedTopOfNext = curr.inningHalf === "bottom"
    ? curr.inning
    : Math.max(prev.inning, curr.inning - 1);
  const label = `THROUGH ${ordinal(passedTopOfNext).toUpperCase()}`;
  return {
    kind: "quiet-stretch",
    gameId: prev.gameId,
    cardId: `${prev.gameId}-qs-${prev.inning}-${prev.inningHalf}-${curr.inning}-${curr.inningHalf}`,
    index: 0,
    label,
    subtitle: `${describeScoreState(prev.scoreAfter, input.homeTeamAbbr, input.awayTeamAbbr)} ${quietFlavor(prev.scoreAfter)}`.trim(),
    score: prev.scoreAfter,
    homeTeamAbbr: input.homeTeamAbbr,
    awayTeamAbbr: input.awayTeamAbbr,
    fromInning: prev.inning,
    fromHalf: prev.inningHalf,
    toInning: curr.inning,
    toHalf: curr.inningHalf,
  };
}

function quietFlavor(score: { home: number; away: number }): string {
  const diff = Math.abs(score.home - score.away);
  if (diff === 0) return "Both pitchers in command.";
  if (diff <= 2) return "The score holds.";
  return "Neither side scratches.";
}

function buildLateGame(
  curr: PlayCardData,
  input: RhythmPlannerInput,
): RhythmCard {
  const margin = Math.abs(curr.scoreBefore.home - curr.scoreBefore.away);
  const subtitle = margin === 0
    ? `Tied entering the ${ordinal(curr.inning)}.`
    : `${describeScoreState(curr.scoreBefore, input.homeTeamAbbr, input.awayTeamAbbr)} Every runner matters now.`;
  return {
    kind: "late-game",
    gameId: curr.gameId,
    cardId: `${curr.gameId}-lg-${curr.inning}-${curr.inningHalf}`,
    index: 0,
    label: "LATE INNINGS",
    subtitle,
    score: curr.scoreBefore,
    homeTeamAbbr: input.homeTeamAbbr,
    awayTeamAbbr: input.awayTeamAbbr,
    toInning: curr.inning,
    toHalf: curr.inningHalf,
  };
}

function buildFinalSetup(
  curr: PlayCardData,
  input: RhythmPlannerInput,
): RhythmCard {
  const margin = Math.abs(curr.scoreBefore.home - curr.scoreBefore.away);
  const half = curr.inningHalf === "top" ? "Top" : "Bottom";
  const battingTeamLeads =
    (curr.inningHalf === "bottom" && curr.scoreBefore.home > curr.scoreBefore.away) ||
    (curr.inningHalf === "top" && curr.scoreBefore.away > curr.scoreBefore.home);
  let subtitle: string;
  if (margin === 0) {
    subtitle = `${half} ${ordinal(curr.inning)}, tied.`;
  } else if (battingTeamLeads) {
    subtitle = `${half} ${ordinal(curr.inning)}. Hold the lead.`;
  } else {
    subtitle = `${half} ${ordinal(curr.inning)}. Down to the wire.`;
  }
  return {
    kind: "final-setup",
    gameId: curr.gameId,
    cardId: `${curr.gameId}-fs-${curr.inning}-${curr.inningHalf}`,
    index: 0,
    label: "FINAL APPROACH",
    subtitle,
    score: curr.scoreBefore,
    homeTeamAbbr: input.homeTeamAbbr,
    awayTeamAbbr: input.awayTeamAbbr,
    toInning: curr.inning,
    toHalf: curr.inningHalf,
  };
}
