import type {
  GameListResponse,
  GameDetailResponse,
  GameFlowResponse,
  BetsResponse,
  FairbetLiveResponse,
  LiveGameInfo,
} from "./types";
import { useAuth } from "@/stores/auth";

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuth.getState().token;
  // Normalize any HeadersInit form (Headers, [k,v][], or object) into a plain record
  const headers: Record<string, string> = {};
  if (init?.headers) {
    const src =
      init.headers instanceof Headers
        ? init.headers
        : new Headers(init.headers as HeadersInit);
    src.forEach((v, k) => {
      headers[k] = v;
    });
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401) {
    // Token expired — clear auth state
    useAuth.getState().logout();
  }
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
  fairbetLiveGames: (league?: string) => {
    const params = new URLSearchParams();
    if (league) params.set("league", league);
    const qs = params.toString();
    return fetchApi<LiveGameInfo[]>(`/api/fairbet/live/games${qs ? `?${qs}` : ""}`);
  },
  fairbetLive: (gameId: number, marketCategory?: string, sortBy?: string) => {
    const params = new URLSearchParams({ game_id: String(gameId) });
    if (marketCategory) params.set("market_category", marketCategory);
    if (sortBy) params.set("sort_by", sortBy);
    return fetchApi<FairbetLiveResponse>(`/api/fairbet/live?${params}`);
  },
};
