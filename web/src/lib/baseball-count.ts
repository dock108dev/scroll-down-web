import type { PlayEventType } from "@/lib/types";
import type { SdmHalfInningEvent } from "@/types/scroll-down-mlb";

export interface BaseballCount {
  balls: number;
  strikes: number;
}

export type CountPhase = "preview" | "revealed" | "next";
export type TerminalPitchResult = "walk" | "strikeout" | "ball_in_play";

export interface CountValidationContext {
  gameId?: string | number;
  cardId?: string;
  eventId?: string | number;
  playIndex?: number;
  inning?: number;
  half?: "top" | "bottom";
  phase?: CountPhase | "before" | "after";
}

const warnedInvalidCounts = new Set<string>();

export function normalizeDisplayCount(
  count: Partial<BaseballCount> | null | undefined,
  terminalResult?: TerminalPitchResult,
  phase: CountPhase = "preview",
  context?: CountValidationContext,
): BaseballCount | undefined {
  if (count == null) return undefined;
  const rawBalls = count.balls;
  const rawStrikes = count.strikes;
  if (typeof rawBalls !== "number" || typeof rawStrikes !== "number") {
    logInvalidCount(count, "missing_or_non_numeric", context);
    return undefined;
  }
  if (!Number.isFinite(rawBalls) || !Number.isFinite(rawStrikes)) {
    logInvalidCount(count, "non_finite", context);
    return undefined;
  }

  const balls = clampWhole(rawBalls, 0, 3);
  const strikes = clampWhole(rawStrikes, 0, 2);
  if (balls !== rawBalls || strikes !== rawStrikes) {
    logInvalidCount(count, "outside_display_range", context);
  }
  if (terminalResult && phase !== "preview") {
    return { balls: 0, strikes: 0 };
  }
  return { balls, strikes };
}

export function inferTerminalPitchResult(
  eventType?: PlayEventType | string | null,
  event?: SdmHalfInningEvent | null,
): TerminalPitchResult | undefined {
  const result = event?.result;
  if (result?.isWalk || eventType === "walk" || eventType === "hit_by_pitch" || eventType === "catcher_interference") {
    return "walk";
  }
  if (result?.isStrikeout || eventType === "strikeout") {
    return "strikeout";
  }
  if (
    result?.isHit ||
    result?.isOut ||
    eventType === "single" ||
    eventType === "double" ||
    eventType === "triple" ||
    eventType === "home_run" ||
    eventType === "field_out" ||
    eventType === "double_play" ||
    eventType === "triple_play" ||
    eventType === "fielders_choice" ||
    eventType === "error" ||
    eventType === "sacrifice"
  ) {
    return "ball_in_play";
  }
  return undefined;
}

export function isValidDisplayCount(count: Partial<BaseballCount> | null | undefined): boolean {
  if (!count) return false;
  const { balls, strikes } = count;
  return (
    typeof balls === "number" &&
    typeof strikes === "number" &&
    Number.isInteger(balls) &&
    Number.isInteger(strikes) &&
    balls >= 0 &&
    balls <= 3 &&
    strikes >= 0 &&
    strikes <= 2
  );
}

function clampWhole(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function logInvalidCount(
  count: Partial<BaseballCount>,
  reason: string,
  context?: CountValidationContext,
): void {
  if (typeof console === "undefined") return;
  const key = JSON.stringify({ count, reason, context });
  if (warnedInvalidCounts.has(key)) return;
  warnedInvalidCounts.add(key);
  console.warn("[scroll-down-mlb] invalid count suppressed", {
    reason,
    count,
    context,
  });
}
