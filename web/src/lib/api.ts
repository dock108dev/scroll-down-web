import type {
  CatchupCardsResponse,
  CatchupSummaryResponse,
  GameListResponse,
} from "./types";

const FETCH_TIMEOUT_MS = 5_000;

type FetchApiInit = RequestInit & { timeoutMs?: number };

function buildRequestSignal(
  userSignal: AbortSignal | null | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onUserAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener("abort", onUserAbort, { once: true });
  }
  const cleanup = () => {
    clearTimeout(timeoutId);
    if (userSignal) userSignal.removeEventListener("abort", onUserAbort);
  };
  return { signal: controller.signal, cleanup };
}

export async function fetchApi<T>(path: string, init?: FetchApiInit): Promise<T> {
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

  const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const { signal, cleanup } = buildRequestSignal(init?.signal ?? undefined, timeoutMs);

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.", { cause: err });
    }
    // Preserve the original error via `cause` so devtools / future log
    // sinks see the underlying network detail instead of a stripped
    // user-facing string. See docs/audits/error-handling-report.md §I2.
    throw new Error("Unable to load data. Please check your connection and try again.", { cause: err });
  } finally {
    cleanup();
  }

  if (!res.ok) {
    if (res.status === 404) throw new Error("Not found.");
    if (res.status === 429) throw new Error("Data is busy right now. We'll try again shortly.");
    if (res.status === 503) throw new Error("Live data is temporarily delayed. We'll try again shortly.");
    if (res.status >= 500) throw new Error("Something went wrong on our end. Please try again later.");
    throw new Error("Unable to load data. Please check your connection and try again.");
  }
  return res.json();
}

export const api = {
  recentGames: (init?: FetchApiInit) =>
    fetchApi<GameListResponse>("/api/games/recent", init),
  cards: (gameId: number, opts?: { since?: number }, init?: FetchApiInit) => {
    const qs = opts?.since !== undefined ? `?since=${opts.since}` : "";
    return fetchApi<CatchupCardsResponse>(`/api/games/${gameId}/cards${qs}`, init);
  },
  summary: (gameId: number, init?: FetchApiInit) =>
    fetchApi<CatchupSummaryResponse>(`/api/games/${gameId}/summary`, init),
};
