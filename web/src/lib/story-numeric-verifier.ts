import type { BoxScoreInput, SalientEvent } from "./salient-events";

// ─── Public types ──────────────────────────────────────────

export interface NumericVerificationResult {
  valid: boolean;
  rejectedNumbers: number[];
  storyNumbers: number[];
  whitelistSize: number;
}

// ─── Extraction helpers ────────────────────────────────────

/** Extract all integers and decimals from a text string, deduped. */
export function extractStoryNumbers(text: string): number[] {
  const matches = text.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const m of matches) {
    const n = parseFloat(m);
    if (!seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  }
  return result;
}

/** Recursively collect all numeric values from an arbitrary data structure. */
function collectNumbers(value: unknown, out: Set<number>): void {
  if (typeof value === "number" && isFinite(value)) {
    out.add(value);
    return;
  }
  if (typeof value === "string") {
    const matches = value.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
    for (const m of matches) out.add(parseFloat(m));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, out);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectNumbers(v, out);
    }
  }
}

/**
 * Build the allowed-number whitelist from the source box score and the
 * salient events derived from it. Events are included because the LLM
 * prompt feeds their descriptions as facts (e.g. "14-0 run" where 14 is
 * computed by summing play point-deltas, not a raw field in the box score).
 */
export function buildNumericWhitelist(
  input: BoxScoreInput,
  events: SalientEvent[],
): Set<number> {
  const whitelist = new Set<number>();
  collectNumbers(input, whitelist);
  for (const event of events) {
    collectNumbers(event, whitelist);
  }
  return whitelist;
}

// ─── Main verifier ─────────────────────────────────────────

/**
 * Extract every integer/decimal from story text and assert each one appears
 * in the whitelist derived from the box score and salient events.
 * Returns `valid: false` with the offending numbers if any are unrecognised.
 */
export function verifyStoryNumerics(
  storyText: string,
  input: BoxScoreInput,
  events: SalientEvent[],
): NumericVerificationResult {
  const whitelist = buildNumericWhitelist(input, events);
  const storyNumbers = extractStoryNumbers(storyText);
  const rejectedNumbers = storyNumbers.filter((n) => !whitelist.has(n));

  return {
    valid: rejectedNumbers.length === 0,
    rejectedNumbers,
    storyNumbers,
    whitelistSize: whitelist.size,
  };
}
