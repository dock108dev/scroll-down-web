import type { BaseballBaseState, PlayCardData, RunnerAdvance } from "./types";

/**
 * Internal-consistency warnings for a rendered play card. These catch
 * cases where the data we're about to show contradicts itself — score
 * changed but no runner crossed home, batter ended on the wrong base
 * for the event type, narration claims a strikeout but outs didn't go
 * up, etc.
 *
 * In dev: log warnings with full card context so we can find bad data.
 * In prod: the chip / runner-advance layers already guard against the
 * worst misleading copy; warnings here are diagnostic, not user-facing.
 */
export type ValidationWarning =
  | "score_delta_without_runner_scored"
  | "runner_scored_without_score_delta"
  | "home_run_without_score_delta"
  | "strikeout_without_out_increment"
  | "extra_base_hit_wrong_batter_destination"
  | "double_play_without_runner_to_force"
  | "triple_play_without_two_runners"
  | "runner_label_not_on_rendered_base"
  | "movement_path_missing_for_runner_change";

export interface ValidationResult {
  warnings: ValidationWarning[];
  /** Detail object for dev logging — useful for "why did this warn?" */
  detail: Record<string, unknown>;
}

const EXPECTED_BATTER_DEST: Partial<Record<NonNullable<PlayCardData["eventType"]>, RunnerAdvance["to"]>> = {
  single: "first",
  double: "second",
  triple: "third",
  home_run: "home",
  walk: "first",
  hit_by_pitch: "first",
  catcher_interference: "first",
  error: "first",
  fielders_choice: "first",
};

function occupiedCount(state: BaseballBaseState): number {
  return (state.first ? 1 : 0) + (state.second ? 1 : 0) + (state.third ? 1 : 0);
}

export function validatePlayCard(card: PlayCardData): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const advances = card.runnerAdvances ?? [];
  const visualScores = advances.filter((a) => a.to === "home").length;
  const reportedRuns =
    (card.scoreAfter.home - card.scoreBefore.home) +
    (card.scoreAfter.away - card.scoreBefore.away);
  const outsBefore = card.situationBefore.outs ?? 0;
  const outsDelta = card.outsAfter - outsBefore;

  // Score / runner-scored consistency.
  if (reportedRuns > 0 && visualScores === 0) {
    warnings.push("score_delta_without_runner_scored");
  }
  if (reportedRuns === 0 && visualScores > 0) {
    warnings.push("runner_scored_without_score_delta");
  }

  // Event-specific.
  if (card.eventType === "home_run" && reportedRuns === 0) {
    warnings.push("home_run_without_score_delta");
  }
  if (card.eventType === "strikeout" && outsDelta < 1) {
    // Dropped third strike + reach is rare but legal — accept when the
    // batter ended up on a base.
    const batterReached = advances.some(
      (a) => a.from === "home" && a.to !== "out",
    );
    if (!batterReached) warnings.push("strikeout_without_out_increment");
  }

  // Batter destination matches event type.
  if (card.eventType && EXPECTED_BATTER_DEST[card.eventType]) {
    const expected = EXPECTED_BATTER_DEST[card.eventType]!;
    const batter = advances.find((a) => a.from === "home");
    if (batter && batter.to !== expected) {
      warnings.push("extra_base_hit_wrong_batter_destination");
    }
  }

  // Double / triple plays need plausible base state to be possible.
  const before = card.situationBefore.baseState;
  if (card.eventType === "double_play" && occupiedCount(before) < 1) {
    warnings.push("double_play_without_runner_to_force");
  }
  if (card.eventType === "triple_play" && occupiedCount(before) < 2) {
    warnings.push("triple_play_without_two_runners");
  }

  return {
    warnings,
    detail: {
      cardId: card.cardId,
      playIndex: card.playIndex,
      eventType: card.eventType,
      scoreBefore: card.scoreBefore,
      scoreAfter: card.scoreAfter,
      reportedRuns,
      visualScores,
      outsBefore,
      outsAfter: card.outsAfter,
      basesBefore: before,
      basesAfter: card.baseStateAfter,
      runnerAdvances: advances,
      description: card.description,
    },
  };
}

/** Dev-mode console.warn helper — call once per card, only in development. */
export function logValidationWarnings(result: ValidationResult): void {
  if (process.env.NODE_ENV === "production") return;
  if (result.warnings.length === 0) return;
  console.warn("[catchup-validation]", result.warnings, result.detail);
}
