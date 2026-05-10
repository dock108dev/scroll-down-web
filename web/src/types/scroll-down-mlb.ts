/**
 * Scroll Down MLB API DTOs.
 *
 * Mirror of the backend Pydantic schemas at
 * `sports-data-admin/api/app/scroll_down_mlb/schemas.py`. The wire shape
 * is camelCase. Critical spoiler-safety invariants:
 *
 *   - `scoreAfter` does not exist on PlayPayload by design. The renderer
 *     computes a transient post-play score locally from
 *     `scoreBefore + runsScoredOnPlay` attributed to the batting team.
 *   - The `/deck` endpoint never returns final score, winner, or recap.
 *     Those live only on `/reveal`.
 *
 * Anything added here must match a field that exists on the backend wire
 * shape. Don't introduce frontend-only fields here — put those on the
 * renderer types in `lib/types.ts`.
 */

export interface SdmTeamSummary {
  id: string;
  abbreviation: string;
  displayName: string;
  colorLight?: string | null;
  colorDark?: string | null;
}

export interface SdmBaseState {
  first: boolean;
  second: boolean;
  third: boolean;
}

export interface SdmScoreState {
  home: number;
  away: number;
}

export interface SdmFinalScore {
  home: number;
  away: number;
}

export interface SdmKeyStat {
  label: string;
  value: string;
  detail?: string | null;
}

export type SdmRunnerStyle = "advance" | "score" | "out" | "hold";

export interface SdmRunnerMovement {
  runner: string;
  from: "home" | "first" | "second" | "third";
  to: "home" | "first" | "second" | "third" | "out";
  style: SdmRunnerStyle;
  outAt?: "home" | "first" | "second" | "third" | null;
}

export interface SdmVisualPayload {
  trajectory?: string | null;
  runnerMovements: SdmRunnerMovement[];
  intensity?: "low" | "medium" | "high" | null;
  animationProfile?: string | null;
}

/**
 * Per-play data on a deck card.
 *
 * Spoiler-safe: scoreAfter is intentionally absent. The renderer computes
 * a transient post-play scoreboard from `scoreBefore` and
 * `runsScoredOnPlay` (attributed to the batting team via `inningHalf`).
 */
export interface SdmPlayPayload {
  playId: string;
  eventType?: string | null;
  label?: string | null;
  subLabel?: string | null;
  description?: string | null;
  batterName?: string | null;
  pitcherName?: string | null;
  /** Pre-formatted running line for the pitcher of record at this play,
   *  e.g. "4.1 IP · 6 K · 1 BB · 2 R". Backend produces the string; the
   *  renderer just shows it. Null when the pitcher isn't known. */
  pitcherStatLine?: string | null;
  ballsBefore?: number | null;
  strikesBefore?: number | null;
  outsBefore?: number | null;
  outsAfter?: number | null;
  baseStateBefore?: SdmBaseState | null;
  baseStateAfter?: SdmBaseState | null;
  runnerNamesBefore: Partial<Record<"first" | "second" | "third", string>>;
  runnerNamesAfter: Partial<Record<"first" | "second" | "third", string>>;
  scoreBefore?: SdmScoreState | null;
  runsScoredOnPlay: number;
}

export type SdmDeckCardType = "scene" | "play" | "rhythm" | "final_setup";

export interface SdmDeckCard {
  id: string;
  type: SdmDeckCardType;
  sortOrder: number;
  inning?: number | null;
  half?: "top" | "bottom" | null;
  title?: string | null;
  description: string;
  play?: SdmPlayPayload | null;
  visual?: SdmVisualPayload | null;
  leverageTier?: number | null;
}

export interface SdmPlannerNote {
  cardId?: string | null;
  kind: string;
  reason: string;
  afterPlayIndex?: number | null;
  beforePlayIndex?: number | null;
}

export interface SdmPlannerReport {
  rhythm: SdmPlannerNote[];
}

export type SdmValidationSeverity = "warning" | "error";

export interface SdmValidationWarning {
  code: string;
  severity: SdmValidationSeverity;
  message: string;
  playId?: string | null;
}

export interface SdmDeckResponse {
  gameId: string;
  deckVersion: string;
  generatedAt: string;
  isFinal: boolean;
  spoilerPolicy: "pre_reveal";
  homeTeam?: SdmTeamSummary | null;
  awayTeam?: SdmTeamSummary | null;
  lastPlayIndex?: number | null;
  /** ISO timestamp of first pitch — used by the matchup intro card. */
  firstPitch?: string | null;
  venue?: string | null;
  homeProbablePitcher?: string | null;
  awayProbablePitcher?: string | null;
  cards: SdmDeckCard[];
  plannerReport?: SdmPlannerReport | null;
  validationWarnings: SdmValidationWarning[];
}

export interface SdmRecentGame {
  gameId: string;
  league: "MLB";
  gameDate?: string | null;
  status?: string | null;
  statusType?: string | null;
  awayTeam: SdmTeamSummary;
  homeTeam: SdmTeamSummary;
  venueName?: string | null;
  startTime?: string | null;
  hasDeck: boolean;
  deckVersion?: string | null;
  isFinal: boolean;
}

export interface SdmRecentResponse {
  games: SdmRecentGame[];
}

export interface SdmRevealResponse {
  gameId: string;
  finalScore: SdmFinalScore;
  winnerTeamId?: string | null;
  summary?: string | null;
  keyStats: SdmKeyStat[];
  gameFlow: unknown[];
  generatedAt?: string | null;
}
