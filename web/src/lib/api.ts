import type {
  GameListResponse,
  GameDetailResponse,
  GameFlowResponse,
  TimelineArtifactResponse,
  PbpResponse,
  SocialPostListResponse,
  TeamSummary,
  BetsResponse,
} from "./types";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

export const api = {
  games: (params?: URLSearchParams) =>
    fetchApi<GameListResponse>(`/api/games${params ? `?${params}` : ""}`),
  game: (id: number) => fetchApi<GameDetailResponse>(`/api/games/${id}`),
  flow: (id: number) => fetchApi<GameFlowResponse>(`/api/games/${id}/flow`),
  timeline: (id: number) =>
    fetchApi<TimelineArtifactResponse>(`/api/games/${id}/timeline`),
  pbp: (id: number) => fetchApi<PbpResponse>(`/api/games/${id}/pbp`),
  social: (id: number) =>
    fetchApi<SocialPostListResponse>(`/api/games/${id}/social`),
  teams: () => fetchApi<TeamSummary[]>("/api/teams"),
  fairbetOdds: (params?: URLSearchParams) =>
    fetchApi<BetsResponse>(
      `/api/fairbet/odds${params ? `?${params}` : ""}`,
    ),
  parlayEvaluate: (legs: { game_id: number; market_key: string; selection_key: string; line_value?: number }[]) =>
    fetchApi<{ fair_probability: number; fair_american_odds: number; confidence: string; leg_count: number }>(
      "/api/fairbet/parlay/evaluate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legs }),
      },
    ),
};
