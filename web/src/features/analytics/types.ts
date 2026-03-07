// ─── Simulation ─────────────────────────────────────────

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

// ─── Pitch Model ────────────────────────────────────────

export interface PitchProbabilities {
  ball: number;
  called_strike: number;
  swinging_strike: number;
  foul: number;
  in_play: number;
}

export interface PitchModelResponse {
  pitch_probabilities: PitchProbabilities;
}

// ─── Run Expectancy ─────────────────────────────────────

export interface RunExpectancyResponse {
  expected_runs: number;
}

// ─── Analytics App ──────────────────────────────────────

export interface AnalyticsAppDef {
  id: string;
  title: string;
  description: string;
  leagues: string[];
  requiresLive: boolean;
}

// ─── Game context passed to all analytics apps ──────────

export interface AnalyticsGameContext {
  gameId: number;
  leagueCode: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor: string;
  awayColor: string;
  isLive: boolean;
}
