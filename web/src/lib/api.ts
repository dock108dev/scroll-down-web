import type {
  GameListResponse,
  GameDetailResponse,
  GameFlowResponse,
  BetsResponse,
  FairbetLiveResponse,
  LiveGameInfo,
} from "./types";
import type {
  GolfTournamentListResponse,
  GolfTournament,
  GolfLeaderboardResponse,
} from "./golf-types";
import { useAuth } from "@/stores/auth";

const FETCH_TIMEOUT_MS = 3_000;

type FetchApiInit = RequestInit & { timeoutMs?: number };

function buildRequestSignal(
  userSignal: AbortSignal | null | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onUserAbort = () => {
    controller.abort();
  };

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort();
    } else {
      userSignal.addEventListener("abort", onUserAbort, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timeoutId);
    if (userSignal) {
      userSignal.removeEventListener("abort", onUserAbort);
    }
  };

  return { signal: controller.signal, cleanup };
}

export async function fetchApi<T>(path: string, init?: FetchApiInit): Promise<T> {
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

  const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const { signal, cleanup } = buildRequestSignal(
    init?.signal ?? undefined,
    timeoutMs,
  );

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    throw new Error("Unable to load data. Please check your connection and try again.");
  } finally {
    cleanup();
  }

  if (res.status === 401 && token) {
    // Token expired or stale — clear auth state silently
    useAuth.getState().logout();
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("We're having trouble loading data right now. Please try again later.");
    } else if (res.status >= 500) {
      throw new Error("Something went wrong on our end. Please try again later.");
    }
    throw new Error("Unable to load data. Please check your connection and try again.");
  }
  return res.json();
}

export const api = {
  games: (params?: URLSearchParams, init?: FetchApiInit) =>
    fetchApi<GameListResponse>(`/api/games${params ? `?${params}` : ""}`, init),
  historyGames: (params?: URLSearchParams, init?: FetchApiInit) =>
    fetchApi<GameListResponse>(`/api/history${params ? `?${params}` : ""}`, init),
  game: (id: number) => fetchApi<GameDetailResponse>(`/api/games/${id}`),
  flow: (id: number) => fetchApi<GameFlowResponse>(`/api/games/${id}/flow`),
  fairbetOdds: (params?: URLSearchParams, init?: FetchApiInit) =>
    fetchApi<BetsResponse>(
      `/api/fairbet/odds${params ? `?${params}` : ""}`,
      init,
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
  golfTournaments: (params?: URLSearchParams, init?: RequestInit) =>
    fetchApi<GolfTournamentListResponse>(
      `/api/golf/tournaments${params ? `?${params}` : ""}`,
      init,
    ),
  golfTournament: (eventId: string) =>
    fetchApi<GolfTournament>(`/api/golf/tournaments/${eventId}`),
  golfLeaderboard: (eventId: string) =>
    fetchApi<GolfLeaderboardResponse>(
      `/api/golf/tournaments/${eventId}/leaderboard`,
    ),
};
