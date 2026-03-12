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
