// ─── Enums ──────────────────────────────────────────────

export type GameStatus =
  | "scheduled"
  | "pregame"
  | "in_progress"
  | "live"
  | "completed"
  | "final"
  | "archived"
  | "postponed"
  | "canceled";

export type LeagueCode = "nba" | "ncaab" | "nfl" | "ncaaf" | "mlb" | "nhl";

export type MarketType =
  | "spread"
  | "moneyline"
  | "total"
  | "alternate_spread"
  | "alternate_total"
  | "player_points"
  | "player_rebounds"
  | "player_assists"
  | "player_threes"
  | "player_blocks"
  | "player_steals"
  | "player_goals"
  | "player_shots_on_goal"
  | "player_total_saves"
  | "player_pra"
  | "team_total";

export type MarketCategory =
  | "mainline"
  | "player_prop"
  | "team_prop"
  | "alternate"
  | "period"
  | "game_prop";

export type MediaType = "video" | "image" | "none";

export type EventType = "pbp" | "tweet" | "odds" | "unknown";

export type ScoreRevealMode = "always" | "onMarkRead";

export type OddsFormat = "american" | "decimal" | "fractional";

export type BlockRole =
  | "setup"
  | "momentum_shift"
  | "response"
  | "decision_point"
  | "resolution"
  | "unknown";

// ─── Game List / Summary ────────────────────────────────
// Admin API returns camelCase

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
  gameDate: string;
  status: GameStatus;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  currentPeriod?: number;
  gameClock?: string;
  hasBoxscore?: boolean;
  hasPlayerStats?: boolean;
  hasOdds?: boolean;
  hasSocial?: boolean;
  hasPbp?: boolean;
  hasFlow?: boolean;
  playCount?: number;
  socialPostCount?: number;
  hasRequiredData?: boolean;
  scrapeVersion?: number;
  lastScrapedAt?: string;
  lastIngestedAt?: string;
  lastPbpAt?: string;
  lastSocialAt?: string;
  homeTeamColorLight?: string;
  homeTeamColorDark?: string;
  awayTeamColorLight?: string;
  awayTeamColorDark?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  derivedMetrics?: Record<string, unknown>;
  isLive?: boolean;
  isFinal?: boolean;
  isPregame?: boolean;
  isTrulyCompleted?: boolean;
  readEligible?: boolean;
  currentPeriodLabel?: string;
  dateSection?: string;
  liveSnapshot?: { periodLabel?: string; timeLabel?: string; homeScore?: number; awayScore?: number; gameClock?: string } | null;
}

// ─── Game Detail ────────────────────────────────────────

export interface GameDetailResponse {
  game: Game;
  teamStats: TeamStat[];
  playerStats: PlayerStat[];
  odds: OddsEntry[];
  socialPosts: SocialPostEntry[];
  plays: PlayEntry[];
  derivedMetrics: Record<string, unknown>;
  rawPayloads: Record<string, unknown>;
  groupedPlays?: ServerTieredPlayGroup[];
  nhlSkaters?: NHLSkaterStat[];
  nhlGoalies?: NHLGoalieStat[];
  dataHealth?: NHLDataHealth;
}

export interface Game {
  id: number;
  leagueCode: string;
  season?: number;
  seasonType?: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: GameStatus;
  currentPeriod?: number;
  gameClock?: string;
  scrapeVersion?: number;
  lastScrapedAt?: string;
  hasBoxscore?: boolean;
  hasPlayerStats?: boolean;
  hasOdds?: boolean;
  hasSocial?: boolean;
  hasPbp?: boolean;
  hasFlow?: boolean;
  playCount?: number;
  socialPostCount?: number;
  homeTeamXHandle?: string;
  awayTeamXHandle?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeTeamColorLight?: string;
  homeTeamColorDark?: string;
  awayTeamColorLight?: string;
  awayTeamColorDark?: string;
  lastIngestedAt?: string;
  lastPbpAt?: string;
  lastSocialAt?: string;
  lastOddsAt?: string;
  isLive?: boolean;
  isFinal?: boolean;
  isPregame?: boolean;
  isTrulyCompleted?: boolean;
  readEligible?: boolean;
  currentPeriodLabel?: string;
  dateSection?: string;
  liveSnapshot?: { periodLabel?: string; timeLabel?: string; homeScore?: number; awayScore?: number; gameClock?: string } | null;
}

// ─── Stats ──────────────────────────────────────────────

export interface TeamStat {
  team: string;
  isHome: boolean;
  stats: Record<string, unknown>;
  source?: string;
  updatedAt?: string;
}

export interface PlayerStat {
  team: string;
  playerName: string;
  minutes?: number;
  points?: number;
  rebounds?: number;
  assists?: number;
  yards?: number;
  touchdowns?: number;
  rawStats: Record<string, unknown>;
  source?: string;
  updatedAt?: string;
}

export interface NHLSkaterStat {
  team: string;
  playerName: string;
  toi?: string;
  goals?: number;
  assists?: number;
  points?: number;
  shotsOnGoal?: number;
  plusMinus?: number;
  penaltyMinutes?: number;
  hits?: number;
  blockedShots?: number;
  rawStats?: Record<string, unknown>;
  source?: string;
  updatedAt?: string;
}

export interface NHLGoalieStat {
  team: string;
  playerName: string;
  toi?: string;
  shotsAgainst?: number;
  saves?: number;
  goalsAgainst?: number;
  savePercentage?: number;
  rawStats?: Record<string, unknown>;
  source?: string;
  updatedAt?: string;
}

export interface NHLDataHealth {
  skaterCount?: number;
  goalieCount?: number;
  isHealthy?: boolean;
  issues?: string[];
}

// ─── Plays / Timeline ───────────────────────────────────

export interface PlayEntry {
  playIndex: number;
  quarter?: number;
  gameClock?: string;
  playType?: string;
  teamAbbreviation?: string;
  playerName?: string;
  description?: string;
  homeScore?: number;
  awayScore?: number;
  periodLabel?: string;
  timeLabel?: string;
  tier?: number;
  scoreChanged?: boolean;
  scoringTeamAbbr?: string;
  pointsScored?: number;
  phase?: string;
}

export interface ServerTieredPlayGroup {
  startIndex: number;
  endIndex: number;
  playIndices: number[];
  summaryLabel: string;
}

// ─── Odds (from game detail — camelCase) ────────────────

export interface OddsEntry {
  book: string;
  marketType: MarketType;
  marketCategory?: string;
  playerName?: string;
  description?: string;
  side?: string;
  line?: number;
  price?: number;
  isClosingLine: boolean;
  observedAt?: string;
  isBest?: boolean;
}

// ─── Social ─────────────────────────────────────────────

export interface SocialPostEntry {
  id: number;
  postUrl: string;
  postedAt: string;
  hasVideo: boolean;
  teamAbbreviation: string;
  tweetText?: string;
  videoUrl?: string;
  imageUrl?: string;
  sourceHandle?: string;
  mediaType?: MediaType;
  gamePhase?: string;
  revealLevel?: string; // "pre" | "post" — for spoiler gating
  likesCount?: number;
  retweetsCount?: number;
  repliesCount?: number;
}

// ─── Flow ───────────────────────────────────────────────

export interface GameFlowResponse {
  game_id: number;
  sport?: string;
  plays: FlowPlay[];
  blocks: FlowBlock[];
  validation_passed: boolean;
  validation_errors: string[];
  home_team?: string;
  away_team?: string;
  home_team_abbr?: string;
  away_team_abbr?: string;
  league_code?: string;
  home_team_color_light?: string;
  home_team_color_dark?: string;
  away_team_color_light?: string;
  away_team_color_dark?: string;
  moments: FlowMoment[];
}

export interface FlowBlock {
  block_index: number;
  role: BlockRole;
  moment_indices: number[];
  period_start: number;
  period_end: number;
  score_before: number[];
  score_after: number[];
  play_ids: number[];
  key_play_ids: number[];
  narrative: string;
  mini_box?: BlockMiniBox;
  embedded_social_post_id?: number;
}

export interface FlowPlay {
  play_id: number;
  play_index: number;
  period: number;
  clock?: string;
  play_type?: string;
  description?: string;
  team?: string;
  player_name?: string;
  home_score?: number;
  away_score?: number;
}

export interface FlowMoment {
  play_ids: number[];
  explicitly_narrated_play_ids: number[];
  period: number;
  start_clock?: string;
  end_clock?: string;
  score_before: number[];
  score_after: number[];
}

export interface BlockMiniBox {
  home: BlockTeamMiniBox;
  away: BlockTeamMiniBox;
  block_stars: string[];
}

export interface BlockTeamMiniBox {
  team: string;
  players: BlockPlayerStat[];
}

export interface BlockPlayerStat {
  name: string;
  pts?: number;
  reb?: number;
  ast?: number;
  three_pm?: number;
  delta_pts?: number;
  delta_reb?: number;
  delta_ast?: number;
  goals?: number;
  assists?: number;
  sog?: number;
  plus_minus?: number;
  delta_goals?: number;
  delta_assists?: number;
}

// ─── Timeline Artifact ──────────────────────────────────

export interface TimelineArtifactResponse {
  game_id?: number;
  sport?: string;
  timeline_version?: string;
  generated_at?: string;
  timeline_json?: unknown;
  game_analysis_json?: unknown;
  summary_json?: unknown;
}

// ─── PBP ────────────────────────────────────────────────

export interface PbpEvent {
  id: string | number;
  gameId?: string | number;
  period?: number;
  gameClock?: string;
  elapsedSeconds?: number;
  eventType?: string;
  description?: string;
  team?: string;
  teamId?: string;
  playerName?: string;
  playerId?: string | number;
  homeScore?: number;
  awayScore?: number;
}

export interface PbpResponse {
  events: PbpEvent[];
}

// ─── Teams ──────────────────────────────────────────────

export interface TeamListResponse {
  teams: TeamSummary[];
}

export interface TeamSummary {
  name: string;
  colorLightHex?: string;
  colorDarkHex?: string;
}

// ─── FairBet (snake_case from fairbet API) ──────────────

export interface BetsResponse {
  bets: APIBet[];
  total: number;
  books_available: string[];
  games_available?: GameDropdown[];
  market_categories_available?: string[];
  ev_diagnostics?: EVDiagnostics;
  ev_config?: { min_books_for_display?: number; ev_color_thresholds?: { strong_positive?: number; positive?: number } };
}

export interface APIBet {
  game_id: number;
  league_code: string;
  home_team: string;
  away_team: string;
  game_date: string;
  market_key: string;
  selection_key: string;
  line_value?: number;
  books: BookPrice[];
  market_category?: string;
  has_fair?: boolean;
  player_name?: string;
  ev_method?: string;
  ev_confidence_tier?: string;
  ev_disabled_reason?: string;
  true_prob?: number;
  reference_price?: number;
  opposite_reference_price?: number;
  bet_description?: string;
  description?: string;
  // API snake_case fields
  fair_american_odds?: number;
  selection_display?: string;
  market_display_name?: string;
  best_book?: string;
  best_ev_percent?: number;
  confidence_display_label?: string;
  ev_method_display_name?: string;
  ev_method_explanation?: string;
  is_reliably_positive?: boolean;
  estimated_sharp_price?: number | null;
  extrapolation_ref_line?: number | null;
  extrapolation_distance?: number | null;
  confidence?: number;
  confidence_flags?: string[];
  explanation_steps?: ExplanationStep[] | null;
  // Client-enriched camelCase aliases
  fairAmericanOdds?: number;
  selectionDisplay?: string;
  marketDisplayName?: string;
  bestBook?: string;
  bestEvPercent?: number;
  confidenceDisplayLabel?: string;
  evMethodDisplayName?: string;
  evMethodExplanation?: string;
}

export interface ExplanationStep {
  step_number: number;
  title: string;
  description?: string;
  detail_rows?: { label: string; value: string; is_highlight?: boolean }[];
}

export interface BookPrice {
  book: string;
  price: number;
  observed_at: string;
  ev_percent?: number;
  display_ev?: number;
  implied_prob?: number;
  true_prob?: number;
  is_sharp?: boolean;
  ev_method?: string;
  ev_confidence_tier?: string;
  book_abbr?: string;
  price_decimal?: number;
  ev_tier?: string;
  // Client aliases
  bookAbbr?: string;
  priceDecimal?: number;
  evTier?: string;
}

export interface GameDropdown {
  game_id: number;
  matchup: string;
  game_date: string;
}

export interface EVDiagnostics {
  total_pairs?: number;
  total_unpaired?: number;
  eligible?: number;
  no_pair?: number;
  reference_missing?: number;
  extrapolated?: number;
}

// ─── Social Post List ───────────────────────────────────

export interface SocialPostListResponse {
  posts: SocialPostResponse[];
  total: number;
}

export interface SocialPostResponse {
  id: number;
  game_id: number;
  team_id: string;
  post_url: string;
  posted_at: string;
  has_video: boolean;
  video_url?: string;
  image_url?: string;
  tweet_text?: string;
  source_handle?: string;
  media_type?: MediaType;
  reveal_level?: string;
  game_phase?: string;
  likes_count?: number;
  retweets_count?: number;
  replies_count?: number;
}

// ─── Helpers ────────────────────────────────────────────

export function isLive(status: GameStatus, game?: { isLive?: boolean }): boolean {
  if (game?.isLive !== undefined) return game.isLive;
  return status === "live" || status === "in_progress";
}

export function isFinal(status: GameStatus, game?: { isFinal?: boolean }): boolean {
  if (game?.isFinal !== undefined) return game.isFinal;
  return status === "final" || status === "completed" || status === "archived";
}

export function isPregame(status: GameStatus, game?: { isPregame?: boolean }): boolean {
  if (game?.isPregame !== undefined) return game.isPregame;
  return status === "pregame" || status === "scheduled";
}
