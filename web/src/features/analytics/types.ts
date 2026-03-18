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
  probability_mode?: "rule_based" | "ml" | "ensemble";
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

export interface FeatureConfig {
  id: string;
  name: string;
  features: string[];
  feature_count: number;
  is_active: boolean;
  created_at: string;
}

export interface AvailableFeature {
  name: string;
  description?: string;
  category?: string;
}

export interface TrainingJob {
  id: string;
  status: string;
  created_at: string;
  completed_at?: string;
  metrics?: {
    accuracy: number;
    brier_score?: number;
    log_loss?: number;
  };
}

export interface RegisteredModel {
  id: string;
  name: string;
  version: string;
  is_active: boolean;
  created_at: string;
  metrics?: {
    accuracy: number;
    brier_score?: number;
    log_loss?: number;
  };
}

export interface CalibrationBucket {
  range: string;
  count: number;
  actual_rate: number;
  predicted_rate: number;
}

export interface CalibrationReport {
  model_id: string;
  buckets: CalibrationBucket[];
  overall_brier: number;
  created_at: string;
}

export interface DegradationAlert {
  metric: string;
  message: string;
  severity: string;
  detected_at: string;
}

// ─── Batch Types ────────────────────────────────────────────

export interface BatchSimRequest {
  date: string;
  model_id?: string;
  iterations: number;
}

export interface BatchSummary {
  avg_home_win_prob: number;
  avg_total: number;
  duration_seconds: number;
}

export interface BatchJob {
  id: string;
  date: string;
  status: string;
  games_count: number;
  iterations: number;
  created_at: string;
  summary?: BatchSummary;
  warnings?: string[];
}

export interface PredictionOutcome {
  date: string;
  home_team: string;
  away_team: string;
  predicted_home_win_prob: number;
  actual_home_win: boolean;
  correct: boolean;
}

// ─── Experiments Types ──────────────────────────────────────

export interface ExperimentSuite {
  id: string;
  name: string;
  status: string;
  variant_count: number;
  created_at: string;
  parameter_grid?: Record<string, unknown>;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  status: string;
  parameters: Record<string, unknown>;
  metrics?: {
    accuracy: number;
    brier_score?: number;
    log_loss?: number;
  };
}

export interface ExperimentDetail extends ExperimentSuite {
  variants?: ExperimentVariant[];
}

export interface ReplayJob {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  games_processed: number;
  games_total: number;
  created_at: string;
}

// ─── Profiles Types ─────────────────────────────────────────

export interface TeamProfile {
  team: string;
  window_days: number;
  games_in_window: number;
  metrics: Record<string, number>;
  league_baselines?: Record<string, number>;
}

export interface DataCoverage {
  teams_count: number;
  games_count: number;
  earliest_date: string;
  latest_date: string;
}
