import type { PlayCardData, PlayEventType } from "./types";

/**
 * Narrative rewrite layer. Turns the deterministic data on a PlayCardData
 * into a sentence with a bit more emotional shape than the raw upstream
 * description. Strict rule: every clause must be supported by data on the
 * card. We never invent stadium reactions, pitch types, or unattributed
 * commentary. When in doubt the function returns `undefined` and the UI
 * falls back to the humanized upstream description.
 *
 * Why a layer at all: the raw feed text reads like a stat line ("Walks on
 * a 3-2 pitch."). On a card that's already showing the count and the
 * runners, the sentence can take on a tiny bit of context ("Walks to load
 * the bases.") without inventing anything.
 */

interface NarrativeContext {
  /** When true, the play occurs in the 7th inning or later. */
  isLate: boolean;
  /** When true, the score difference entering the play is ≤ 2. */
  isCloseGame: boolean;
  /** Runs scored on this play. */
  runsScored: number;
  /** Number of runners on base entering the play. */
  runnersOnBefore: number;
  /** True when the bases were loaded entering the play. */
  basesLoadedBefore: boolean;
  /** True when the play loads the bases. */
  basesLoadedAfter: boolean;
  /** Two outs entering the play (so any out ends the inning). */
  twoOutsBefore: boolean;
  /** Three outs after — the inning ended on this play. */
  inningOver: boolean;
  /** Last name of the batter, when known. */
  batterLast?: string;
  /** Last name of the pitcher, when known. */
  pitcherLast?: string;
}

function lastNameOnly(full: string | undefined): string | undefined {
  if (!full) return undefined;
  const trimmed = full.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(/\s+/);
  let last = parts[parts.length - 1];
  if (/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(last) && parts.length >= 2) {
    last = parts[parts.length - 2];
  }
  return last.replace(/[.,;]$/, "");
}

function occupied(state: { first: boolean; second: boolean; third: boolean }): number {
  return (state.first ? 1 : 0) + (state.second ? 1 : 0) + (state.third ? 1 : 0);
}

function buildContext(card: PlayCardData): NarrativeContext {
  const before = card.situationBefore.baseState;
  const after = card.baseStateAfter;
  const runsScored =
    (card.scoreAfter.home - card.scoreBefore.home) +
    (card.scoreAfter.away - card.scoreBefore.away);
  return {
    isLate: card.inning >= 7,
    isCloseGame: Math.abs(card.scoreBefore.home - card.scoreBefore.away) <= 2,
    runsScored: Math.max(0, runsScored),
    runnersOnBefore: occupied(before),
    basesLoadedBefore: before.first && before.second && before.third,
    basesLoadedAfter: after.first && after.second && after.third,
    twoOutsBefore: (card.situationBefore.outs ?? 0) >= 2,
    inningOver: card.outsAfter >= 3,
    batterLast: lastNameOnly(card.situationBefore.batterName),
    pitcherLast: lastNameOnly(card.situationBefore.pitcherName),
  };
}

function endPunct(s: string): string {
  if (!s) return s;
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

// ── Per-event templates ────────────────────────────────────

function narrateWalk(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.basesLoadedAfter && ctx.basesLoadedBefore) {
    return `${who} walks home a run with the bases loaded.`;
  }
  if (ctx.basesLoadedAfter) {
    return `${who} draws a walk to load the bases.`;
  }
  if (ctx.runnersOnBefore >= 1 && ctx.isLate) {
    return `${who} works a walk to add a runner late.`;
  }
  if (ctx.runnersOnBefore >= 1) {
    return `${who} draws a walk and another runner is aboard.`;
  }
  return `${who} works the count and draws a walk.`;
}

function narrateHbp(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.basesLoadedAfter) {
    return `${who} gets clipped by a pitch and a run is forced in.`;
  }
  if (ctx.runnersOnBefore >= 2) {
    return `${who} is hit by a pitch — the bases get more crowded.`;
  }
  if (ctx.runnersOnBefore === 1) {
    return `${who} is hit by a pitch to put a second runner on.`;
  }
  return `${who} is hit by a pitch to reach.`;
}

function narrateStrikeout(ctx: NarrativeContext): string {
  const pitcher = ctx.pitcherLast;
  const batter = ctx.batterLast ?? "the batter";
  if (ctx.inningOver && ctx.runnersOnBefore > 0) {
    return pitcher
      ? `${pitcher} punches out ${batter} to strand the threat.`
      : `${capitalize(batter)} strikes out and the threat is stranded.`;
  }
  if (ctx.inningOver) {
    return pitcher
      ? `${pitcher} punches out ${batter} to end the half.`
      : `${capitalize(batter)} strikes out to end the half.`;
  }
  if (ctx.twoOutsBefore && ctx.runnersOnBefore > 0) {
    return pitcher
      ? `${pitcher} freezes ${batter} for the strikeout — runners stranded.`
      : `${capitalize(batter)} strikes out — runners stranded.`;
  }
  return pitcher
    ? `${pitcher} strikes out ${batter}.`
    : `${capitalize(batter)} strikes out.`;
}

function narrateSingle(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.runsScored >= 2) {
    return `${who} singles and ${ctx.runsScored} runs come home.`;
  }
  if (ctx.runsScored === 1) {
    return `${who} singles home a run.`;
  }
  if (ctx.basesLoadedAfter) {
    return `${who} singles to load the bases.`;
  }
  if (ctx.runnersOnBefore >= 1) {
    return `${who} singles and pushes the runner along.`;
  }
  return `${who} lines a single into play.`;
}

function narrateDouble(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.runsScored >= 2) {
    return `${who} doubles into the gap and ${ctx.runsScored} score.`;
  }
  if (ctx.runsScored === 1) {
    return `${who} doubles in a run.`;
  }
  if (ctx.runnersOnBefore >= 1) {
    return `${who} doubles to put runners in scoring position.`;
  }
  return `${who} laces a double.`;
}

function narrateTriple(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.runsScored >= 1) {
    return `${who} legs out a triple and ${ctx.runsScored === 1 ? "a run scores" : `${ctx.runsScored} runs score`}.`;
  }
  return `${who} legs out a triple.`;
}

function narrateHomeRun(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.runsScored >= 4) {
    return `${who} crushes a grand slam.`;
  }
  if (ctx.runsScored === 3) {
    return `${who} launches a 3-run homer.`;
  }
  if (ctx.runsScored === 2) {
    return `${who} hits a 2-run shot.`;
  }
  return `${who} goes deep for a solo home run.`;
}

function narrateFieldOut(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.inningOver && ctx.runnersOnBefore > 0) {
    return `${who} is retired to end the half — runners left on.`;
  }
  if (ctx.inningOver) {
    return `${who} is retired to end the half.`;
  }
  if (ctx.runsScored >= 1) {
    return `${who} gets retired but a run crosses on the play.`;
  }
  return `${who} is retired.`;
}

function narrateDoublePlay(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.inningOver) {
    return `${who} grounds into a double play to end the threat.`;
  }
  return `${who} grounds into a double play — two outs in a hurry.`;
}

function narrateTriplePlay(_: NarrativeContext): string {
  return `Triple play — the half is over in a single swing.`;
}

function narrateSacrifice(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.runsScored >= 1) {
    return `${who} lifts a sacrifice and ${ctx.runsScored === 1 ? "a run scores" : `${ctx.runsScored} runs score`}.`;
  }
  return `${who} moves the runner over with a sacrifice.`;
}

function narrateError(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.runsScored >= 1) {
    return `${who} reaches on an error and a run scores.`;
  }
  return `${who} reaches on an error.`;
}

function narrateFieldersChoice(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  if (ctx.runsScored >= 1) {
    return `${who} reaches on a fielder's choice and a run comes in.`;
  }
  return `${who} reaches on a fielder's choice; the lead runner is retired.`;
}

function narrateStolenBase(ctx: NarrativeContext): string {
  return ctx.batterLast
    ? `Steal — a runner moves up behind ${ctx.batterLast}.`
    : `A runner steals the next bag.`;
}

function narrateCaughtStealing(_: NarrativeContext): string {
  return `Runner caught stealing — the threat is over.`;
}

function narratePickoff(_: NarrativeContext): string {
  return `Pickoff — the runner is caught off the bag.`;
}

function narrateWildPitch(ctx: NarrativeContext): string {
  if (ctx.runsScored >= 1) {
    return `Wild pitch — a run scores on the loose ball.`;
  }
  return `Wild pitch — every runner moves up.`;
}

function narratePassedBall(ctx: NarrativeContext): string {
  if (ctx.runsScored >= 1) {
    return `Passed ball at the plate — a run scores.`;
  }
  return `Passed ball — runners advance.`;
}

function narrateBalk(_: NarrativeContext): string {
  return `Balk called — every runner moves up a base.`;
}

function narrateCatcherInterference(ctx: NarrativeContext): string {
  const who = ctx.batterLast ?? "The batter";
  return `Catcher's interference — ${who} is awarded first.`;
}

const NARRATORS: Partial<Record<PlayEventType, (ctx: NarrativeContext) => string>> = {
  walk: narrateWalk,
  hit_by_pitch: narrateHbp,
  strikeout: narrateStrikeout,
  single: narrateSingle,
  double: narrateDouble,
  triple: narrateTriple,
  home_run: narrateHomeRun,
  field_out: narrateFieldOut,
  double_play: narrateDoublePlay,
  triple_play: narrateTriplePlay,
  sacrifice: narrateSacrifice,
  error: narrateError,
  fielders_choice: narrateFieldersChoice,
  stolen_base: narrateStolenBase,
  caught_stealing: narrateCaughtStealing,
  pickoff: narratePickoff,
  wild_pitch: narrateWildPitch,
  passed_ball: narratePassedBall,
  balk: narrateBalk,
  catcher_interference: narrateCatcherInterference,
};

/**
 * Produce a richer sentence for the play, or `undefined` when no template
 * applies. The result is always a complete sentence with terminating
 * punctuation.
 */
export function narrativeForCard(card: PlayCardData): string | undefined {
  const event = card.eventType;
  if (!event) return undefined;
  const fn = NARRATORS[event];
  if (!fn) return undefined;
  const sentence = fn(buildContext(card));
  if (!sentence) return undefined;
  return endPunct(sentence);
}
