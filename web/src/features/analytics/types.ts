export interface ScoreOutcome {
  home: number;
  away: number;
  frequency: number;
}

export interface SimulationResult {
  win_probability_home: number;
  win_probability_away: number;
  average_home_score: number;
  average_away_score: number;
  score_distribution: ScoreOutcome[];
}
