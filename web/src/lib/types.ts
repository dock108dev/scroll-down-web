// ─── Enums ──────────────────────────────────────────────

export type GameStatus =
  | "scheduled"
  | "pregame"
  | "in_progress"
  | "live"
  | "completed"
  | "final"
  | "recap_ready"
  | "archived"
  | "postponed"
  | "canceled";

// ─── Game List / Summary ────────────────────────────────
// The proxy strips score fields before this reaches the client. The shape
// keeps optional score/status fields for any internal callers that still
// consume the raw upstream payload.

export interface GameListResponse {
  games: GameSummary[];
  startDate?: string;
  endDate?: string;
  range?: string;
  total?: number;
  nextOffset?: number;
  lastUpdatedAt?: string;
}

export interface GameSummary {
  id: number;
  leagueCode: string;
  /** ISO timestamp of first pitch (with time + timezone). */
  gameDate: string;
  /** YYYY-MM-DD schedule date in league/venue-local calendar (authoritative for grouping). */
  localGameDate?: string;
  status: GameStatus;
  homeTeam: string;
  awayTeam: string;
  homeTeamColorLight?: string;
  homeTeamColorDark?: string;
  awayTeamColorLight?: string;
  awayTeamColorDark?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  isLive?: boolean;
  isFinal?: boolean;
  isPregame?: boolean;
  /** Number of key plays available — used to size progress bars. Score-free. */
  keyPlayCount?: number;
  /** Latest play index produced upstream — used for live "since=" polling. */
  lastPlayIndex?: number;
}

// ─── Catch-up Cards ─────────────────────────────────────
// Sent to the client during the spoiler-free flow.
//
// Spoiler model: each card carries the situation entering the play
// (`scoreBefore`, runners, outs, batter, pitcher) plus the play description.
// The card never carries score-AFTER; the user infers the result from the
// next card's situation and from the visual animation. The final score lives
// only on the /summary endpoint, fetched after explicit reveal.

export type CatchupCardKind =
  | "scene-setter"
  | "play"
  | "inning-transition"
  | "quiet-stretch"
  | "late-game"
  | "final-setup";

export interface SceneSetterCard {
  kind: "scene-setter";
  gameId: number;
  cardId: string;
  index: number;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  homeTeam: string;
  awayTeam: string;
  /** ISO first-pitch timestamp. */
  firstPitch: string;
  /** Optional probable starters; backend may omit until ~lineups posted. */
  homeProbablePitcher?: string | null;
  awayProbablePitcher?: string | null;
  /** Optional venue (city or park name). */
  venue?: string | null;
}

export interface BaseballBaseState {
  first: boolean;
  second: boolean;
  third: boolean;
}

/** Names of the runners occupying each base, when known. Parallel to
 *  BaseballBaseState — populated by forward-simulating across the play
 *  feed, so even when upstream doesn't ship per-play runner objects we
 *  still know who's on what. */
export interface RunnerNames {
  first?: string;
  second?: string;
  third?: string;
}

export type BallPath =
  | "none"
  | "pitch"
  | "foul"
  // Home runs — exit OVER the wall toward the appropriate outfield zone.
  // No vertical-beam path; HR direction comes from the play description.
  | "home_run_left"
  | "home_run_center"
  | "home_run_right"
  // Grounders — terminate at the fielder's position, not the mound.
  | "ground_3b"
  | "ground_ss"
  | "ground_p"
  | "ground_2b"
  | "ground_1b"
  // Line drives — straight, low, into the gap.
  | "line_left"
  | "line_center"
  | "line_right"
  // Outfield flies — endpoints stay INSIDE the wall (HR is the only path
  // that intentionally leaves the field of play).
  | "fly_lf"
  | "fly_lcf"
  | "fly_cf"
  | "fly_rcf"
  | "fly_rf"
  // Infield popup — small loop above the plate.
  | "popup";

export interface RunnerAdvance {
  from: "home" | "first" | "second" | "third";
  to: "first" | "second" | "third" | "home" | "out";
  /** When the runner is out, the spot they were tagged or forced. Drives
   *  the runner-dot animation: instead of flaring in place, the dot first
   *  travels to `outAt` and then flares out there. */
  outAt?: "first" | "second" | "third" | "home";
}

/**
 * Movement class for a runner. Drives per-movement timing, afterimage
 * persistence, and pulse intensity in the field renderer. Each class has
 * its own grammar — a steal snaps, a walk shuffles, a score gets extra
 * weight, a double-play transfer chains.
 *
 * Classified at render time from (RunnerAdvance, eventType) so the data
 * model stays event-agnostic; the visual layer owns the choreography.
 */
export type RunnerMovementStyle =
  | "advance"      // routine safe advance — single, sac, RBI hit
  | "score"        // crossing home — extra emphasis on arrival
  | "steal"        // SB / WP / PB / balk — fast, snappy, no stagger
  | "walk_shuffle" // walk / HBP / catcher's interference — slower, lower energy
  | "double_play"  // chained out within a DP — feeds the secondary throw
  | "forced_out"   // FC / pickoff / caught stealing — short travel, hard cut
  | "tagged_out"   // out somewhere along the path (e.g. out at home)
  | "in_place_out"; // strikeout/popup flare at home with no travel

/**
 * Per-event animation grammar. Drives trail timing, fade persistence, glow
 * intensity, and whether the play has a secondary segment (e.g. a DP throw).
 *
 * Each profile is meant to read distinctly: home runs linger with afterglow,
 * grounders fade quickly, double plays show catch-then-throw choreography,
 * walks have no trail at all.
 */
export type PlayAnimationProfile =
  | "home_run"
  | "deep_fly"
  | "shallow_fly"
  | "popup"
  | "line_drive"
  | "routine_grounder"
  | "hard_grounder"
  | "foul"
  | "walk"
  | "strikeout"
  | "stolen_base"
  | "wild_pitch"
  | "double_play_grounder"
  | "double_play_fly"
  | "sacrifice_fly"
  | "rundown"
  | "other";

export type PlayEventType =
  | "single"
  | "double"
  | "triple"
  | "home_run"
  | "walk"
  | "hit_by_pitch"
  | "strikeout"
  | "field_out"
  | "double_play"
  | "triple_play"
  | "fielders_choice"
  | "error"
  | "stolen_base"
  | "caught_stealing"
  | "pickoff"
  | "wild_pitch"
  | "passed_ball"
  | "balk"
  | "sacrifice"
  | "catcher_interference"
  | "other";

export interface SituationBefore {
  outs?: number;
  balls?: number;
  strikes?: number;
  baseState: BaseballBaseState;
  batterName?: string;
  pitcherName?: string;
}

/**
 * Snapshot of the game state at the END of the previously-displayed card.
 * Attached to play cards so the front-end can render that ending state on
 * mount, then "bridge" to this card's `situationBefore` during the opening
 * beat — so the user sees outs / runners progress between sampled plays
 * rather than jumping abruptly.
 *
 * Absent on the first play card after a scene setter (no prior state) and
 * after an inning-transition card (the transition itself bridges).
 */
export interface PriorAfterState {
  score: { home: number; away: number };
  baseState: BaseballBaseState;
  runnerNames: RunnerNames;
  outs: number;
  inning: number;
  inningHalf: "top" | "bottom";
}

export interface PlayCardData {
  kind: "play";
  gameId: number;
  cardId: string;
  /** Position in the rendered deck (0 = scene setter). */
  index: number;
  /** Monotonic order from the upstream play feed. */
  playIndex: number;
  /** Inning number (1+). */
  inning: number;
  /** Top or bottom of the inning. */
  inningHalf: "top" | "bottom";
  /** "Top 3rd", "Bottom 7th" — kept as a denormalized display label. */
  inningLabel: string;
  /** Three-letter abbreviation of the team currently at bat. */
  battingTeamAbbr?: string;
  description: string;
  /** Optional richer narrative sentence — when present the UI shows this
   *  instead of `description`. Templates are factual extensions of the
   *  upstream play; they never invent detail not implied by the data. */
  narrative?: string;
  /** Score state ENTERING this play. */
  scoreBefore: { home: number; away: number };
  /** Score state EXITING this play. The card animates from before → after
   *  during the runner-advance phase so the scoreboard moves with the play. */
  scoreAfter: { home: number; away: number };
  situationBefore: SituationBefore;
  /** Outs after the play resolves. Always present — derived from the event
   *  type when upstream doesn't ship it directly. */
  outsAfter: number;
  /** Base occupancy after the play resolves. Always present; predicted from
   *  the event type when upstream doesn't ship it. */
  baseStateAfter: BaseballBaseState;
  /** Names of the runners on base entering this play. Empty entries mean the
   *  base is empty OR we don't know who's on it. */
  runnerNamesBefore?: RunnerNames;
  /** Names of the runners on base after the play resolves. */
  runnerNamesAfter?: RunnerNames;
  runnerAdvances?: RunnerAdvance[];
  ballPath?: BallPath;
  eventType?: PlayEventType;
  /** Drives the per-event animation timing/grammar in the field. */
  animationProfile?: PlayAnimationProfile;
  /** Hint for animation amplitude. */
  visualIntensity?: "low" | "medium" | "high";
  /** Backend-computed leverage tier (0 routine, 1 elevated, 2 climactic).
   *  Drives narrative pacing constants on the card. Defaults to 0 when the
   *  backend doesn't provide it. */
  leverageTier?: 0 | 1 | 2;
  /** Backend-computed primary chip text — e.g. "GRAND SLAM", "STRIKEOUT". */
  chipPrimary?: string;
  /** Backend-computed secondary chip text — e.g. "RUN SCORES", "INNING OVER". */
  chipSecondary?: string;
  /** Game state at the end of the previously-displayed card. Drives the
   *  bridging beat so the user sees state evolve between sampled plays. */
  priorAfter?: PriorAfterState;
}

/**
 * Inserted between play cards when the half-inning changes between them.
 * Pure rhythm card — no animation timeline beyond a fade-in. The user
 * scrolls past it as a breath between innings.
 *
 * `phase` is "end" when a half ended cleanly (3 outs were burned and we're
 * now in the next half), "mid" when transitioning into the bottom of an
 * inning that has at least one displayed play (rare; mostly covers the
 * 7th-inning-stretch beat).
 */
export interface InningTransitionCard {
  kind: "inning-transition";
  gameId: number;
  cardId: string;
  index: number;
  /** "END 3RD" / "MID 7TH" — uppercase headline. */
  label: string;
  phase: "end" | "mid";
  score: { home: number; away: number };
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  /** Optional flavor line — e.g. "Yankees lead by 1." */
  subtitle?: string;
  /** What inning we're transitioning OUT of. */
  fromInning: number;
  fromHalf: "top" | "bottom";
  /** What inning the next play card belongs to. */
  toInning: number;
  toHalf: "top" | "bottom";
}

/**
 * Pacing card — non-play cards that the rhythm planner inserts to give
 * the deck breath, compress dead innings, set up late-game tension, and
 * frame the final beat. Distinct from `inning-transition` (which handles
 * single-half rolls) and `scene-setter` (which is the game intro).
 *
 * The kind discriminator drives subtle visual treatment but the data
 * shape is uniform, since these cards exist purely as text + score
 * snapshots. The planner decides when each kind is appropriate.
 */
export type RhythmCardKind = "quiet-stretch" | "late-game" | "final-setup";

export interface RhythmCard {
  kind: RhythmCardKind;
  gameId: number;
  cardId: string;
  index: number;
  /** Headline — usually inning-range or a stage marker.
   *  e.g. "INNINGS 4-6", "LATE INNINGS", "FINAL APPROACH". */
  label: string;
  /** Flavor line under the headline. Always factual / spoiler-safe.
   *  e.g. "Both pitchers in command.", "Game tied entering the 7th." */
  subtitle: string;
  score: { home: number; away: number };
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  /** Inning context when meaningful (quiet stretches span a range). */
  fromInning?: number;
  fromHalf?: "top" | "bottom";
  toInning?: number;
  toHalf?: "top" | "bottom";
}

export type CatchupCard =
  | SceneSetterCard
  | PlayCardData
  | InningTransitionCard
  | RhythmCard;

export interface CatchupCardsResponse {
  gameId: number;
  /** Mirrors the latest play index so a client can poll with `?since=`. */
  lastPlayIndex: number;
  /** True once the upstream game is in a terminal status. */
  isFinal: boolean;
  cards: CatchupCard[];
  /** Populated when the route is called with `?debug=true`. One entry per
   *  upstream play, including those filtered out of the deck. */
  audit?: SelectionAuditRow[];
}

export type SelectionReason =
  | "tier-1"
  | "scoring"
  | "tying"
  | "lead-change"
  | "late-leverage"
  | "tier-2-sampled"
  | "tier-2-not-sampled"
  | "tier-3-skipped"
  | "no-tier-not-sampled"
  | "missing-data";

export interface SelectionAuditRow {
  playIndex: number;
  inning: number;
  half: "top" | "bottom" | "unknown";
  outsBefore: number;
  outsAfter: number;
  scoreBefore: { home: number; away: number };
  scoreAfter: { home: number; away: number };
  runsScored: number;
  baseStateBefore: BaseballBaseState;
  baseStateAfter: BaseballBaseState;
  eventType: PlayEventType;
  description: string;
  battingTeamAbbr?: string;
  batterName?: string;
  pitcherName?: string;
  tier: number;
  isScoringPlay: boolean;
  isTyingPlay: boolean;
  isLeadChangePlay: boolean;
  isLateLeverage: boolean;
  isSelectedForCatchup: boolean;
  selectionReasons: SelectionReason[];
}

// ─── Reveal / Summary ───────────────────────────────────

export interface CatchupSummaryResponse {
  gameId: number;
  finalScore: { home: number; away: number };
  winner: "home" | "away" | "tie";
  /** Single narrative summary string from the gameflow endpoint. */
  summary: string;
}

// ─── Plays / Timeline (raw upstream shape) ──────────────
// Kept so server-side adapters can read upstream plays. Not consumed by the
// catch-up UI; that uses `PlayCardData` from the cards proxy.

export interface PlayEntry {
  eventId?: string;
  playIndex: number;
  quarter?: number;
  gameClock?: string;
  playType?: string;
  teamAbbreviation?: string;
  playerName?: string;
  description?: string;
  homeScore?: number;
  awayScore?: number;
  score?: { home?: number; away?: number } | null;
  periodLabel?: string;
  timeLabel?: string;
  tier?: number;
  scoreChanged?: boolean;
  scoringTeamAbbr?: string;
  pointsScored?: number;
  homeScoreBefore?: number;
  awayScoreBefore?: number;
  scoreBefore?: { home?: number; away?: number } | null;
  phase?: string;
}

// ─── Helpers ────────────────────────────────────────────

export const TERMINAL_STATUSES: GameStatus[] = ["final", "recap_ready", "completed", "archived", "postponed", "canceled"];
export const PREGAME_STATUSES: GameStatus[] = ["pregame", "scheduled"];

export function isLive(status: GameStatus, game?: { isLive?: boolean }): boolean {
  if (TERMINAL_STATUSES.includes(status) || PREGAME_STATUSES.includes(status)) return false;
  if (game?.isLive !== undefined) return game.isLive;
  return status === "live" || status === "in_progress";
}

export function isFinal(status: GameStatus, game?: { isFinal?: boolean }): boolean {
  if (TERMINAL_STATUSES.includes(status)) return true;
  if (game?.isFinal !== undefined) return game.isFinal;
  return false;
}

export function isPregame(status: GameStatus, game?: { isPregame?: boolean }): boolean {
  if (PREGAME_STATUSES.includes(status)) return true;
  if (game?.isPregame !== undefined) return game.isPregame;
  return false;
}
