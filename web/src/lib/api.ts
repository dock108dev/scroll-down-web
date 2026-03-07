import type {
  GameListResponse,
  GameDetailResponse,
  GameFlowResponse,
  BetsResponse,
  FairbetLiveResponse,
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
  fairbetOdds: (params?: URLSearchParams) =>
    fetchApi<BetsResponse>(
      `/api/fairbet/odds${params ? `?${params}` : ""}`,
    ),
  fairbetLive: (gameId: number, marketCategory?: string, sortBy?: string) => {
    const params = new URLSearchParams({ game_id: String(gameId) });
    if (marketCategory) params.set("market_category", marketCategory);
    if (sortBy) params.set("sort_by", sortBy);
    return fetchApi<FairbetLiveResponse>(`/api/fairbet/live?${params}`);
  },
};
