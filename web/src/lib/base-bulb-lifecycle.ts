/**
 * BaseBulb lifecycle — pure mapping from the 3-bit occupancy history
 * `(prior, before, after)` to one of five render states. Extracted so
 * the table is exhaustively unit-testable and the renderer never
 * encodes lifecycle logic inline.
 *
 * `prior`  — base was occupied at the end of the previous card (the
 *            bridge backdrop). `undefined` when no bridge is attached;
 *            in that case treat as equal to `before`.
 * `before` — base is occupied entering this card's play (the user must
 *            see the runner on the bag through setup/pitch/ball).
 * `after`  — base is occupied when this card's play resolves.
 *
 * Tokens:
 *   arrive  — destination-only; hidden through play, lights at settle.
 *   depart  — lit on first paint, fades out at the runners phase.
 *   hold    — solid lit the whole time, no animation.
 *   release — lit at bridge start, fades out at setup end (prior runner
 *             vacates and the bag finishes empty).
 *   swap    — prior runner releases at setup, a different runner
 *             arrives at settle. The bag is empty mid-play.
 *
 * `null` is returned when the base is empty across all three samples,
 * signalling that no bulb should be rendered at all.
 */
export type BaseBulbLifecycle =
  | "arrive"
  | "depart"
  | "hold"
  | "release"
  | "swap";

export interface BulbLifecycleInput {
  prior?: boolean;
  before: boolean;
  after: boolean;
}

export function computeBaseBulbLifecycle(
  input: BulbLifecycleInput,
): BaseBulbLifecycle | null {
  const { before, after } = input;
  const prior = input.prior ?? before;

  if (!prior && !before && !after) return null;
  if (before && after) return "hold";
  if (before && !after) return "depart";
  if (!before && after) return prior ? "swap" : "arrive";
  return "release";
}

export interface RunnerLabelSource {
  id?: string | number | null;
  name?: string | null;
}

/**
 * Compact runner label for the field: FIRST_INITIAL LAST_NAME. Unknown or
 * malformed names render a stable fallback so occupied bases never disappear
 * just because the feed omitted identity.
 */
export function formatRunnerLabel(
  player: RunnerLabelSource | string | null | undefined,
  fallback = "RUNNER",
): string {
  const fullName =
    typeof player === "string"
      ? player
      : player?.name;
  if (!fullName) return fallback;
  const trimmed = fullName.trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fallback;
  const firstInitial = parts[0]?.[0];
  const last = lastNamePart(parts);
  if (!firstInitial || !last) return fallback;
  return `${firstInitial} ${last}`.toUpperCase();
}

export const abbrevRunner = formatRunnerLabel;

function lastNamePart(parts: string[]): string {
  let last = parts[parts.length - 1];
  if (/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(last) && parts.length >= 2) {
    last = parts[parts.length - 2];
  }
  return last.replace(/[.,;:]$/, "");
}
