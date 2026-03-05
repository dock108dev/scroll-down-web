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
  fairbetLive: (gameId: number, marketKey?: string, historyCount?: number) => {
    const params = new URLSearchParams({ game_id: String(gameId) });
    if (marketKey) params.set("market_key", marketKey);
    if (historyCount !== undefined) params.set("history_count", String(historyCount));
    return fetchApi<FairbetLiveResponse>(`/api/fairbet/live?${params}`);
  },
};
