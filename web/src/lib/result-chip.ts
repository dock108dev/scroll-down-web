import type { PlayCardData } from "./types";

/**
 * Visual-weight tier for the result chip. The label text itself
 * (`primary` / `secondary`) is decided server-side and arrives on
 * `card.chipPrimary` / `card.chipSecondary` — see Phase 5 of the
 * scroll-down-mlb migration. This module owns ONLY the tier classifier:
 * a presentation-layer derivation from the already-decided label plus
 * the card's leverage context.
 *
 *   tier 0 = routine outs / walks / HBP / wild pitch     (no glow)
 *   tier 1 = singles, sac bunts, stolen bases, errors    (dim amber)
 *   tier 2 = doubles/triples, run-scores, inning-enders  (amber glow)
 *   tier 3 = home runs, triple plays, multi-run plays    (bloom + pulse)
 *
 * Tier 0 is amplifier-exempt — a routine groundout in a walk-off
 * situation is not epic; the OUTCOME (next card) is. Late/close/loaded
 * contexts boost tiers 1-2 by one, capped at tier 3.
 */
export type ChipTier = 0 | 1 | 2 | 3;

const TIER_ZERO_PRIMARIES = new Set([
  "GROUNDOUT", "FLYOUT", "POP OUT", "LINEOUT", "FORCE OUT", "TAG OUT", "OUT",
  "WALK", "STRIKEOUT", "FIELDER'S CHOICE", "BALK", "WILD PITCH", "PASSED BALL",
  "HIT BY PITCH", "PLAY",
]);


function baseTierFor(primary: string, secondary: string | undefined): ChipTier {
  if (
    primary === "HOME RUN" ||
    primary === "GRAND SLAM" ||
    primary === "INSIDE-THE-PARK HOME RUN" ||
    primary === "TRIPLE PLAY"
  ) return 3;

  if (secondary === "+2 RUNS" || secondary === "+3 RUNS" || secondary === "+4 RUNS") return 3;

  if (primary === "DOUBLE" || primary === "TRIPLE" || primary === "DOUBLE PLAY") return 2;
  if (secondary === "RUN SCORES" || secondary === "INNING OVER") return 2;

  if (TIER_ZERO_PRIMARIES.has(primary)) return 0;

  return 1;
}


function leverageBoost(base: ChipTier, card: PlayCardData): ChipTier {
  if (base === 0 || base === 3) return base;

  const scoreDiff = Math.abs(card.scoreBefore.home - card.scoreBefore.away);
  const scoreDelta =
    (card.scoreAfter.home - card.scoreBefore.home) +
    (card.scoreAfter.away - card.scoreBefore.away);
  const isLate = card.inning >= 8;
  const isClose = scoreDiff <= 2;
  const isTwoOut = (card.situationBefore.outs ?? 0) === 2;
  const bs = card.situationBefore.baseState;
  const isLoaded = !!(bs?.first && bs?.second && bs?.third);
  const isWalkOffSetup =
    card.inningHalf === "bottom" && card.inning >= 9 && scoreDiff <= 1;

  const boost =
    isWalkOffSetup ||
    (isLate && isClose && isTwoOut) ||
    (isLate && isClose && isLoaded) ||
    scoreDelta >= 3
      ? 1 : 0;

  return Math.min(3, base + boost) as ChipTier;
}


/**
 * Visual-weight tier for the chip. Reads the backend-decided
 * `chipPrimary` / `chipSecondary` from the card and combines them with
 * the card's leverage context.
 *
 * Falls back to tier 1 (elevated, generic) when the card has no chip
 * label at all — defensive only; the backend always ships labels in
 * Phase 5+.
 */
export function resultChipTier(card: PlayCardData): ChipTier {
  const primary = card.chipPrimary ?? "PLAY";
  const secondary = card.chipSecondary;
  return leverageBoost(baseTierFor(primary, secondary), card);
}
