import type { PlayCardData } from "./types";

/**
 * Per-card "stage setter" — a transient line shown during the setup
 * phase that orients the user to what changed since the last play card.
 * Fades out before the pitch so it doesn't compete with the action.
 *
 * Returns null when nothing about the situation is novel enough to
 * warrant a line (e.g. consecutive batters in the same half-inning, no
 * unusual leverage). Routine sequencing reads fine without narration;
 * the stage-setter is for *changes* — inning crossings, skipped
 * batters, or stakes that the score panel alone doesn't communicate.
 */
export function computeStageSetter(
  card: PlayCardData,
  prev: PlayCardData | undefined,
): string | null {
  const transition = transitionString(card, prev);
  const stakes = card.leverageTier && card.leverageTier >= 2 ? stakesString(card) : null;

  const parts: string[] = [];
  if (transition) parts.push(transition);
  if (stakes) parts.push(stakes);
  return parts.length > 0 ? parts.join(" · ") : null;
}


/**
 * The "time elapsed" half of the line — what changed in the game
 * timeline since the previous card the user saw.
 */
function transitionString(
  card: PlayCardData,
  prev: PlayCardData | undefined,
): string | null {
  if (!prev) return null;
  if (prev.inning !== card.inning) {
    // Crossing into a new inning — the inning label carries it.
    return card.inningLabel.toUpperCase();
  }
  if (prev.inningHalf !== card.inningHalf) {
    // Same inning, flipped sides.
    return card.inningHalf === "top"
      ? `TOP ${ordinalLabel(card.inning)}`
      : `BOTTOM ${ordinalLabel(card.inning)}`;
  }
  // Same half — how many batters got skipped between cards. playIndex
  // is built as `inning * MULTIPLIER + halfOffset + atBatIndex` in the
  // scraper, so within the same half-inning the diff equals the
  // atBatIndex delta. Subtract 1 because the prev card *was* one of
  // those batters.
  const delta = card.playIndex - prev.playIndex - 1;
  if (delta === 1) return "1 BATTER LATER";
  if (delta > 1) return `${delta} BATTERS LATER`;
  return null;
}


/**
 * The "stakes" half — only emitted for tier-2 (climactic) cards. The
 * score panel and outs LEDs already carry routine counts; the stakes
 * string adds the framing the score alone can't: bases-loaded /
 * scoring-position, score margin from the batting team's perspective,
 * tie game.
 */
function stakesString(card: PlayCardData): string | null {
  const sit = card.situationBefore;
  const occ =
    (sit.baseState.first ? 1 : 0) +
    (sit.baseState.second ? 1 : 0) +
    (sit.baseState.third ? 1 : 0);

  const bits: string[] = [];

  if (occ === 3) {
    bits.push("BASES LOADED");
  } else if (sit.baseState.second || sit.baseState.third) {
    bits.push("RUNNER IN SCORING POSITION");
  }

  // Score-margin framing from the batting team's POV. Tie game is its
  // own beat — bigger emotional punch than "down 0".
  const margin = Math.abs(card.scoreBefore.home - card.scoreBefore.away);
  if (margin === 0) {
    bits.push("TIE GAME");
  } else {
    const battingScore =
      card.inningHalf === "top" ? card.scoreBefore.away : card.scoreBefore.home;
    const otherScore =
      card.inningHalf === "top" ? card.scoreBefore.home : card.scoreBefore.away;
    if (battingScore < otherScore) bits.push(`DOWN ${margin}`);
    else bits.push(`UP ${margin}`);
  }

  return bits.length > 0 ? bits.join(" · ") : null;
}


function ordinalLabel(n: number): string {
  // Matches the card's inningLabel casing for visual consistency.
  const v = Math.abs(n);
  const s = String(n);
  if (v % 100 >= 11 && v % 100 <= 13) return `${s}TH`;
  const last = v % 10;
  if (last === 1) return `${s}ST`;
  if (last === 2) return `${s}ND`;
  if (last === 3) return `${s}RD`;
  return `${s}TH`;
}
