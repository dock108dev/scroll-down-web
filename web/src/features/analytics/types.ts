// ─── Lineup Simulator Types ─────────────────────────────────

export interface SimulatorTeam {
  id: number;
  abbreviation: string;
  name: string;
  short_name: string;
  games_with_stats: number;
}

export interface RosterBatter {
  external_ref: string;
  name: string;
  games_played: number;
}

export interface RosterPitcher {
  external_ref: string;
  name: string;
  games: number;
  avg_ip: number;
}

export interface MLBRosterResponse {
  batters: RosterBatter[];
  pitchers: RosterPitcher[];
}

export interface LineupSlot {
  external_ref: string;
  name: string;
}

export interface PitcherSlot {
  external_ref: string;
  name: string;
  avg_ip?: number;
}

export interface SimulationRequest {
  sport: string;
  home_team: string;
  away_team: string;
  iterations?: number;
  probability_mode?: "rule_based" | "ml" | "ensemble" | "pitch_level";
  home_lineup?: LineupSlot[];
  away_lineup?: LineupSlot[];
  home_starter?: PitcherSlot;
  away_starter?: PitcherSlot;
  starter_innings?: number;
  exclude_playoffs?: boolean;
}

export interface MostCommonScore {
  score: string;
  probability: number;
}

export interface LineupModeInfo {
  enabled: boolean;
  home_batters_resolved: number;
  away_batters_resolved: number;
  home_starter_resolved: boolean;
  away_starter_resolved: boolean;
  starter_innings: number;
}

export interface SimulatorResult {
  sport: string;
  home_team: string;
  away_team: string;
  home_win_probability: number;
  away_win_probability: number;
  average_home_score: number;
  average_away_score: number;
  average_total: number;
  median_total: number;
  most_common_scores: MostCommonScore[];
  iterations: number;
  probability_source?: string;
  profile_meta?: {
    has_profiles?: boolean;
    model_win_probability?: number;
    lineup_mode?: LineupModeInfo;
    home_pitcher?: PitcherProfileInfo;
    away_pitcher?: PitcherProfileInfo;
    home_bullpen?: Record<string, number>;
    away_bullpen?: Record<string, number>;
  };
  home_pa_probabilities?: Record<string, number>;
  away_pa_probabilities?: Record<string, number>;
}

export interface PitcherProfileInfo {
  name: string | null;
  avg_ip: number | null;
  raw_profile: Record<string, number> | null;
  adjusted_profile: Record<string, number> | null;
  is_regressed: boolean;
}

// ─── Models Types ───────────────────────────────────────────

export interface TrainingJob {
  id: number;
  sport: string;
  model_type: string;
  algorithm: string;
  date_start: string;
  date_end: string;
  status: string;
  model_id: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  metrics?: {
    accuracy: number;
    brier_score?: number;
    log_loss?: number;
  };
}

export interface RegisteredModel {
  model_id: number;
  sport: string;
  model_type: string;
  algorithm: string;
  version: number;
  active: boolean;
  artifact_status: string;
  train_count: number;
  test_count: number;
  created_at: string;
  metrics?: {
    accuracy: number;
    brier_score?: number;
    log_loss?: number;
  };
}

export interface CalibrationReport {
  total_predictions: number;
  resolved: number;
  accuracy: number;
  brier_score: number;
  avg_home_score_error: number;
  avg_away_score_error: number;
  home_bias: number;
}

export interface DegradationAlert {
  metric: string;
  message: string;
  severity: string;
  detected_at: string;
}

// ─── Batch Types ────────────────────────────────────────────

export interface BatchSimRequest {
  sport: string;
  date_start: string;
  date_end: string;
  model_id?: string;
  iterations?: number;
  probability_mode?: string;
  rolling_window?: number;
}

export interface BatchSummary {
  avg_runs_per_team: number;
  avg_total_per_game: number;
  avg_pa_per_team: number | null;
  home_win_rate: number;
  wp_distribution: Record<string, number>;
}

export interface BatchJob {
  id: number;
  sport: string;
  probability_mode: string;
  iterations: number;
  rolling_window: number;
  date_start: string | null;
  date_end: string | null;
  status: string;
  game_count: number | null;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
  batch_summary?: BatchSummary;
  warnings?: string[];
}

export interface PredictionOutcome {
  id: number;
  game_id: number;
  sport: string;
  home_team: string;
  away_team: string;
  predicted_home_wp: number | null;
  predicted_away_wp: number | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  probability_mode: string;
  game_date: string | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
  home_win_actual: boolean | null;
  correct_winner: boolean | null;
  brier_score: number | null;
  outcome_recorded_at: string | null;
  created_at: string | null;
}

// ─── Profiles Types ─────────────────────────────────────────

export interface TeamProfile {
  team: string;
  games_used: number;
  date_range: [string, string];
  metrics: Record<string, number>;
  baselines?: Record<string, number>;
  season_breakdown?: Record<string, number>;
}

export interface DataCoverage {
  advanced_data_coverage: {
    pa: boolean;
    pitch: boolean;
    fielding: boolean;
  };
  counts: {
    player_advanced_stats: number;
    pitcher_game_stats: number;
    team_advanced_stats: number;
    fielding_stats: number;
  };
}
