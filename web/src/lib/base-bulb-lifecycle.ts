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

/**
 * Mattel-style runner-name truncation for on-field labels. Strips to
 * the last whitespace-delimited token and clips to 8 chars with no
 * ellipsis — short enough to fit beside the small base squares without
 * crowding the basepaths.
 */
export function abbrevRunner(fullName: string | undefined): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1];
  return last.slice(0, 8).toUpperCase();
}
