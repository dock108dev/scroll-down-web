// ─── Simulator ──────────────────────────────────────────

export interface SimulatorTeam {
  abbreviation: string;
  name: string;
  short_name: string | null;
  games_with_stats: number;
}

export interface SimulatorTeamsResponse {
  teams: SimulatorTeam[];
  count: number;
}

export interface MostCommonScore {
  score: string;
  probability: number;
}

export interface PAProbabilities {
  strikeout: number;
  walk: number;
  single: number;
  double: number;
  triple: number;
  home_run: number;
}

export interface SimulatorResult {
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
  rolling_window: number;
  profiles_loaded: boolean;
  home_pa_probabilities: PAProbabilities | null;
  away_pa_probabilities: PAProbabilities | null;
  model_home_win_probability: number | null;
}
