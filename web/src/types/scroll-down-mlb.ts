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

/**
 * Per-team run delta produced by a single event.
 *
 * Always present on events; both fields are 0 for non-scoring plays.
 * Combined with the already-public pre-play `scoreBefore`, the renderer
 * computes the post-play running score locally — the wire never carries
 * a cumulative post-play total, so the final play of a completed game
 * cannot leak the final score before reveal.
 */
export interface SdmScoreChange {
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

/**
 * Bundled overlay/render hints for a single event. Mirrors the renderer's
 * `hasConfidentBattedBallPath` gate so the backend can authoritatively
 * suppress overlays for plays whose trajectory is non-batted-ball (wild
 * pitch, caught stealing, etc.) without losing the underlying zone data —
 * `hitLocation` keeps the zone string for analytics/debug surfaces.
 */
export interface SdmDisplayHints {
  showBattedBallOverlay?: boolean | null;
  hitLocation?: string | null;
  suppressMovementLines?: boolean | null;
}

export interface SdmVisualPayload {
  trajectory?: string | null;
  intensity?: "low" | "medium" | "high" | null;
  animationProfile?: string | null;
  displayHints?: SdmDisplayHints | null;
}

/**
 * Per-play data on a deck card.
 *
 * Spoiler-safe: scoreAfter is intentionally absent. The renderer computes
 * a transient post-play scoreboard from `scoreBefore` and `scoreChange`
 * (per-team breakdown), or — for older payloads — from `runsScoredOnPlay`
 * attributed to the batting team via `inningHalf`.
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
  /** Per-team run delta produced by this play. Combined with
   *  `scoreBefore`, the renderer reconstructs `scoreAfter` locally
   *  WITHOUT the wire ever carrying a cumulative post-play total.
   *  Optional only for compatibility with older fixtures; the live
   *  backend always emits it (zeros for non-scoring plays). */
  scoreChange?: SdmScoreChange | null;
}

/**
 * Spoiler-safe per-event game-state snapshot used for the pre-play
 * `situationBefore`. `score` is the running pre-play score — safe to
 * ship because it is already public from prior cards.
 *
 * The post-play snapshot uses the score-less `SdmGameSituationAfter`
 * type per the spoiler-safety contract. Mixing them is a type error.
 */
export interface SdmGameSituation {
  inning: number;
  half: "top" | "bottom";
  outs: number;
  score?: SdmScoreState | null;
  count?: { balls: number; strikes: number } | null;
  bases?: SdmBasesSituation;
}

/**
 * Post-play snapshot. Structurally excludes `score` so the wire cannot
 * carry a cumulative post-play total. The renderer computes the revealed
 * score locally as `situationBefore.score + scoreChange`.
 */
export interface SdmGameSituationAfter {
  inning: number;
  half: "top" | "bottom";
  outs: number;
  count?: { balls: number; strikes: number } | null;
  bases?: SdmBasesSituation;
}

export interface SdmRunnerSummary {
  id?: string | null;
  name: string;
}

export interface SdmBasesSituation {
  first?: SdmRunnerSummary | null;
  second?: SdmRunnerSummary | null;
  third?: SdmRunnerSummary | null;
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

/**
 * Player identity used in matchup payloads. `name` is the normalized
 * `FIRST_INITIAL LAST_NAME` label; `id` is the upstream player ID when
 * available (enables stable cross-card keying).
 */
export interface SdmPlayerSummary {
  id?: string | null;
  name: string;
}

/**
 * One runner traversal on a single event. Derived deterministically by
 * the backend from `baseStateBefore` vs `baseStateAfter` plus batter
 * destination from event context. The wire ships the coarse 3-style enum
 * (`advance` / `score` / `out`); the renderer keeps its 8-style
 * classification local. Held runners produce no entry.
 */
export interface SdmBaseMovement {
  runner: { id?: string | null; name: string };
  from: "home" | "first" | "second" | "third";
  to: "home" | "first" | "second" | "third" | "out";
  style: "advance" | "score" | "out";
  outAt?: "first" | "second" | "third" | "home" | null;
  reason?: string | null;
}

/**
 * Per-event result flags + label/description. Replaces ad-hoc event-type
 * string checks: a single canonical place for "is this a hit?", "did the
 * inning end here?", "did anyone score?".
 */
export interface SdmScrollDownEventResult {
  label: string;
  description: string;
  eventType?: string | null;
  isOut: boolean;
  isStrikeout: boolean;
  isWalk: boolean;
  isHit: boolean;
  isScoringPlay: boolean;
  isInningEnding: boolean;
}

/** Batter / pitcher identity at the start of the event. Spoiler-safe. */
export interface SdmScrollDownEventMatchup {
  batter?: SdmPlayerSummary | null;
  pitcher?: SdmPlayerSummary | null;
}

/**
 * Wire-level ScrollDownEvent — one event within a half-inning container.
 *
 * Carries the normalized before/after game state, deterministic
 * `movements`, per-team `scoreChange` delta, classification (`revealType`,
 * `result`), and matchup identity. The renderer consumes these directly
 * rather than re-deriving from base-state diffs.
 *
 * Spoiler contract: no cumulative post-play score is shipped. The
 * renderer computes the revealed score as `scoreBefore + scoreChange`.
 */
export interface SdmHalfInningEvent {
  sequence: number;
  playIndex: number;
  eventType?: string | null;
  outsBefore?: number | null;
  outsAfter?: number | null;
  baseStateBefore?: SdmBaseState | null;
  baseStateAfter?: SdmBaseState | null;
  scoreBefore?: SdmScoreState | null;
  runsScoredOnPlay: number;
  scoreChange: SdmScoreChange;
  movements: SdmBaseMovement[];
  revealType: "pitch" | "plate_appearance" | "play";
  result: SdmScrollDownEventResult;
  matchup: SdmScrollDownEventMatchup;
  isSelected: boolean;
}

/** Per-half summary from the rhythm planner. */
export interface SdmHalfInningMetaPayload {
  scoredRuns: number;
  hadActivity: boolean;
  hadLeadChange: boolean;
  hadTying: boolean;
}

/**
 * Half-inning container — every event for the half plus an overlay of
 * which `playIndex` values the deck builder selected. Container and deck
 * use orthogonal indexing over the same timeline.
 */
export interface SdmHalfInningContainer {
  gameId: string;
  inning: number;
  half: "top" | "bottom";
  battingTeam: SdmTeamSummary;
  fieldingTeam: SdmTeamSummary;
  events: SdmHalfInningEvent[];
  meta: SdmHalfInningMetaPayload;
  selectedPlayIndices: number[];
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
  /**
   * Half-inning containers covering every event in the game (deck-selected
   * and not). Coexists with `cards`: deck cards are a curated subset;
   * containers are the structural full-game grouping that the renderer
   * consumes for normalized event payloads.
   */
  halfInnings?: SdmHalfInningContainer[];
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
