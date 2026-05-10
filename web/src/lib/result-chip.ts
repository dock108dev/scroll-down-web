import type { PlayCardData, PlayEventType } from "./types";

/**
 * Bold device-style label that "clicks in" at the result_lock beat — sits
 * between the field animation and the natural-language sentence. Keeps the
 * UI deterministic per event type instead of letting users parse the long
 * MLB-style description for the headline.
 *
 *   primary:   "STRIKEOUT", "WALK", "HOME RUN", "DOUBLE PLAY", …
 *   secondary: optional second line, e.g. "RUN SCORES", "+2 RUNS",
 *              "INNING OVER", or a strike-three flavor when known.
 */
export interface ResultChipLabel {
  primary: string;
  secondary?: string;
}

const CALLED_STRIKE = /\bcalled\s*out\s*on\s*strikes\b/i;
const SWINGING_STRIKE = /\bstrikes?\s*out\s*swinging\b/i;
const FOUL_TIP = /\bstrikes?\s*out\s*on\s*a\s*foul\s*tip\b/i;
const SAC_FLY = /\bsacrifice\s*fly\b|\bsac\s*fly\b/i;
const SAC_BUNT = /\bsacrifice\s*bunt\b|\bsac\s*bunt\b/i;
const GRAND_SLAM = /\bgrand\s*slam\b/i;
const INSIDE_PARK = /\binside[-\s]?the[-\s]?park\b/i;
const FORCE_OUT = /\bforces?\s*out\b|\bforce\s*out\b/i;
const TAG_OUT = /\btagged?\s*out\b|\btag\s*out\b/i;
const POP_OUT = /\bpops?\s*out\b|\bpop[-\s]?up\b/i;
const LINE_OUT = /\blines?\s*out\b|\bline[-\s]?out\b/i;
const FLY_OUT = /\bflies\s*out\b|\bfly\s*out\b|\bfly\s*ball\b/i;
const GROUND_OUT = /\bgrounds?\s*out\b|\bground\s*out\b/i;
const INFIELD_SINGLE = /\binfield\s*single\b/i;
const BUNT_SINGLE = /\bbunt\s*single\b/i;

/** Primary chip text by event type, sometimes refined by description. */
function primaryFor(event: PlayEventType, description: string): string {
  switch (event) {
    case "strikeout":
      if (CALLED_STRIKE.test(description)) return "CALLED STRIKE THREE";
      if (FOUL_TIP.test(description))      return "STRIKEOUT";
      if (SWINGING_STRIKE.test(description)) return "SWINGING STRIKE THREE";
      return "STRIKEOUT";
    case "walk":
      if (/\bintentional\b/i.test(description)) return "INTENTIONAL WALK";
      return "WALK";
    case "hit_by_pitch":     return "HIT BY PITCH";
    case "catcher_interference": return "CATCHER'S INTERFERENCE";
    case "single":
      if (INFIELD_SINGLE.test(description)) return "INFIELD SINGLE";
      if (BUNT_SINGLE.test(description))    return "BUNT SINGLE";
      return "SINGLE";
    case "double":           return "DOUBLE";
    case "triple":           return "TRIPLE";
    case "home_run":
      if (GRAND_SLAM.test(description))     return "GRAND SLAM";
      if (INSIDE_PARK.test(description))    return "INSIDE-THE-PARK HOME RUN";
      return "HOME RUN";
    case "double_play":      return "DOUBLE PLAY";
    case "triple_play":      return "TRIPLE PLAY";
    case "fielders_choice":  return "FIELDER'S CHOICE";
    case "error":            return "REACHED ON ERROR";
    case "stolen_base":      return "STOLEN BASE";
    case "caught_stealing":  return "CAUGHT STEALING";
    case "pickoff":          return "PICKED OFF";
    case "balk":             return "BALK";
    case "wild_pitch":       return "WILD PITCH";
    case "passed_ball":      return "PASSED BALL";
    case "sacrifice":
      if (SAC_FLY.test(description))  return "SAC FLY";
      if (SAC_BUNT.test(description)) return "SAC BUNT";
      return "SACRIFICE";
    case "field_out":
      if (POP_OUT.test(description))    return "POP OUT";
      if (LINE_OUT.test(description))   return "LINEOUT";
      if (FLY_OUT.test(description))    return "FLYOUT";
      if (GROUND_OUT.test(description)) return "GROUNDOUT";
      if (FORCE_OUT.test(description))  return "FORCE OUT";
      if (TAG_OUT.test(description))    return "TAG OUT";
      return "OUT";
    case "other":
      return "PLAY";
  }
}

/** Optional secondary line — usually a run/inning marker. Validated
 *  against the actual runner advances so we never claim "RUN SCORES"
 *  when no runner can be visually accounted for at home. */
function secondaryFor(card: PlayCardData): string | undefined {
  const reportedRuns =
    (card.scoreAfter.home - card.scoreBefore.home) +
    (card.scoreAfter.away - card.scoreBefore.away);
  const inningOver = card.outsAfter >= 3;

  // INNING OVER takes precedence on terminal-out plays.
  if (inningOver && (card.eventType === "double_play" || card.eventType === "triple_play")) {
    return "INNING OVER";
  }

  // Count runners that VISUALLY cross home (advance.to === "home"). The
  // HR batter going home → home counts as one. Don't show a run-scores
  // copy unless the visual actually supports it — the score number on
  // the scoreboard tells the user what changed.
  const visualScores = (card.runnerAdvances ?? []).filter((a) => a.to === "home").length;
  const safeRuns = Math.min(reportedRuns, visualScores);
  if (safeRuns > 0 && card.eventType !== "home_run") {
    if (safeRuns === 1) return "RUN SCORES";
    return `+${safeRuns} RUNS`;
  }

  if (inningOver && (
    card.eventType === "field_out" ||
    card.eventType === "strikeout" ||
    card.eventType === "sacrifice"
  )) {
    return "INNING OVER";
  }
  return undefined;
}

export function resultChipLabel(card: PlayCardData): ResultChipLabel {
  return {
    primary: primaryFor(card.eventType ?? "other", card.description ?? ""),
    secondary: secondaryFor(card),
  };
}
