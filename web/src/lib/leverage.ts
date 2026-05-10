// PlayCardData import removed in Phase 5 — `computeLeverage` is gone;
// the renderer now reads `card.leverageTier` directly from the deck DTO.

export type InningZone = "early" | "middle" | "late" | "extra";
export type LeverageBand = "low" | "medium" | "high" | "critical";

/** Narrative pacing tier — coarser than LeverageBand and derived from the
 *  full PlayCardData (not just inning + margin). Drives narration timing,
 *  typography weight, and reveal-fade duration so a late close-game RBI
 *  feels different from a 2nd-inning routine grounder. */
export type LeverageTier = 0 | 1 | 2;

/**
 * Pure rendering helpers — no error handling on purpose.
 *
 * Inputs come from `PlayCardData` (`inning: number`, `scoreBefore.{home,away}: number`)
 * which is built from upstream MLB feed normalization in `catchup-cards.ts`
 * with `?? 0` fallbacks at every assembly point. NaN cannot reach these
 * functions through the typed render path, and any cascade fall-through
 * (e.g. `inning = 0`) lands on a safe band ("low" / "early"). CSS
 * variables derived from these labels degrade silently if the value is
 * unexpected, so a wrong band is at worst a wrong glow tint, never a
 * crash. See docs/audits/error-handling-report.md §G3.
 */

/** Coarse inning bucket. Drives DOM data attributes used by CSS for ambient
 *  visual weight (early/middle/late/extra). */
export function inningZone(inning: number): InningZone {
  if (inning <= 3) return "early";
  if (inning <= 6) return "middle";
  if (inning <= 9) return "late";
  return "extra";
}

/** Leverage band derived from inning + score margin. Tuned for the catch-up
 *  visual cascade — see research/inning-leverage-visual-weight.md. */
export function leverageBand(inning: number, margin: number): LeverageBand {
  if (inning <= 3) return "low";
  if (inning <= 6) return "medium";
  if (inning >= 9 && margin <= 2) return "critical";
  if (inning >= 7 && margin <= 1) return "critical";
  if (inning >= 7 && margin >= 5) return "medium";
  return "high";
}

/** Normalized 0–1 weight per band. Drives CSS variable interpolation. */
export const leverageWeightMap: Record<LeverageBand, number> = {
  low: 0.0,
  medium: 0.35,
  high: 0.65,
  critical: 1.0,
};

/**
 * Narrative pacing constants — tier 0 routine, tier 1 elevated, tier 2 climactic.
 * See research/narrative-leverage-pacing-options.md for the design rationale.
 */

/** Extra ms added to the play-phase `settle` step before the narrative
 *  reveals. Bigger tier = longer breath after the play resolves. */
export const NARRATIVE_SETTLE_BONUS_MS: Record<LeverageTier, number> = {
  0: 0,
  1: 400,
  2: 900,
};

/** Fade-in duration for the narrative paragraph, exposed as a CSS variable
 *  so tier 2 sentences bloom slowly rather than snap in. */
export const NARRATIVE_REVEAL_DUR_MS: Record<LeverageTier, number> = {
  0: 200,
  1: 380,
  2: 600,
};

/** Tailwind classes appended to the narrative paragraph by tier. */
export const NARRATIVE_TYPOGRAPHY_CLASS: Record<LeverageTier, string> = {
  0: "text-base font-normal",
  1: "text-lg font-medium",
  2: "text-xl font-semibold tracking-tight",
};

// Note: `computeLeverage` was removed in Phase 5. Leverage tier is now
// decided server-side and arrives on `card.leverageTier`. The renderer
// reads it directly. This module retains only the presentation tables
// (CSS class maps, ms-duration constants) keyed off the backend-supplied
// tier and the inningZone/leverageBand classifiers keyed off inning
// + score margin (pure presentation, not deck-gen).
