// ─── Golf Utilities ──────────────────────────────────────

/** Format a tournament date range for display. */
export function formatDateRange(start: string, end: string, includeYear = false) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    ...(includeYear && { year: "numeric" }),
  };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

// ─── Golf Types ──────────────────────────────────────────

export interface GolfTournament {
  id: number;
  event_id: string;
  tour: string;
  event_name: string;
  course: string;
  start_date: string;
  end_date: string;
  season: number;
  purse: number;
  country: string;
  status: "upcoming" | "in_progress" | "completed";
  current_round: number | null;
}

export interface GolfTournamentListResponse {
  tournaments: GolfTournament[];
  count: number;
}

export interface GolfLeaderboardEntry {
  dg_id: number;
  player_name: string;
  position: string;
  total_score: number;
  today_score: number;
  thru: string;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  status: string;
  sg_total: number | null;
  win_prob: number | null;
  top_5_prob: number | null;
  top_10_prob: number | null;
  make_cut_prob: number | null;
}

export interface GolfLeaderboardResponse {
  event_id: string;
  leaderboard: GolfLeaderboardEntry[];
  count: number;
}
