/**
 * Browser-side Scroll Down MLB API client.
 *
 * Calls the Next.js BFF (`/api/games/...`), which proxies to the SDA
 * `/api/v1/scroll-down-mlb/...` endpoints with the server-side API key.
 * The browser never holds the key.
 *
 * Status semantics:
 *   - 200: deck/reveal/recent payload as documented in
 *          `src/types/scroll-down-mlb.ts`.
 *   - 404: no deck for this game yet — caller renders an empty state.
 *   - 409: reveal not available (game in progress, or upstream not ready).
 *          Caller should keep the user on the gate/live screen.
 *   - 5xx / network: thrown as `ScrollDownMlbApiError` with the status.
 *          The caller's error UI handles it.
 *
 * This module owns its own fetch wrapper rather than going through
 * `lib/api.ts:fetchApi` because we need access to the HTTP status code
 * to differentiate "no data yet" from "real error."
 */

import type {
  SdmDeckResponse,
  SdmRecentResponse,
  SdmRevealResponse,
} from "@/types/scroll-down-mlb";

const FETCH_TIMEOUT_MS = 5_000;

type FetchInit = RequestInit & { timeoutMs?: number };

export class ScrollDownMlbApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ScrollDownMlbApiError";
  }
}

async function rawFetch<T>(path: string, init?: FetchInit): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const userSignal = init?.signal ?? null;
  const onUserAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener("abort", onUserAbort, { once: true });
  }
  try {
    const res = await fetch(path, { ...init, signal: controller.signal });
    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.text();
        detail = body.slice(0, 200);
      } catch {
        // Reading the error body is best-effort: a truncated/streaming
        // upstream can throw here even though we already have the status.
        // The status itself is the load-bearing signal, so we fall back to
        // a status-only message rather than failing the whole request on
        // a missing body. See docs/audits/error-handling-report.md §I3.
      }
      throw new ScrollDownMlbApiError(
        res.status,
        detail || `Request failed with status ${res.status}`,
      );
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ScrollDownMlbApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ScrollDownMlbApiError(
        0,
        "Request timed out. Please check your connection and try again.",
      );
    }
    // Network/parse failure — preserve the original via `cause` so devtools
    // and future log sinks see the underlying detail instead of just the
    // user-facing string. See docs/audits/error-handling-report.md §I2.
    const wrapped = new ScrollDownMlbApiError(
      0,
      "Unable to reach Scroll Down MLB. Check your connection and try again.",
    );
    (wrapped as { cause?: unknown }).cause = err;
    throw wrapped;
  } finally {
    clearTimeout(timer);
    if (userSignal) userSignal.removeEventListener("abort", onUserAbort);
  }
}

/**
 * Fetch the (live or official) Scroll Down deck for a single game.
 *
 * Returns `null` when the backend has no deck available yet (404).
 */
export async function getScrollDownMlbDeck(
  gameId: string,
  init?: FetchInit,
): Promise<SdmDeckResponse | null> {
  try {
    return await rawFetch<SdmDeckResponse>(
      `/api/games/${encodeURIComponent(gameId)}/cards`,
      init,
    );
  } catch (err) {
    if (err instanceof ScrollDownMlbApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Fetch the reveal payload (final score + recap).
 *
 * Returns `null` when the backend reports the reveal is not yet available
 * (409 or 404). The caller keeps the user on the gate/live screen.
 */
export async function getScrollDownMlbReveal(
  gameId: string,
  init?: FetchInit,
): Promise<SdmRevealResponse | null> {
  try {
    return await rawFetch<SdmRevealResponse>(
      `/api/games/${encodeURIComponent(gameId)}/summary`,
      init,
    );
  } catch (err) {
    if (err instanceof ScrollDownMlbApiError && (err.status === 409 || err.status === 404)) {
      return null;
    }
    throw err;
  }
}

/**
 * Fetch the spoiler-safe recent-games list. Throws on network/5xx; the
 * caller's error UI decides what to render.
 */
export async function getScrollDownMlbRecentGames(
  init?: FetchInit,
): Promise<SdmRecentResponse> {
  return rawFetch<SdmRecentResponse>("/api/games/recent", init);
}
