import { API, BACKEND_BASE_URL } from "@/lib/config";

/** Read at call time so CI/Playwright always see the current process env (not a stale module snapshot). */
export function sportsApiBaseUrl(): string {
  return process.env.SPORTS_API_INTERNAL_URL || BACKEND_BASE_URL;
}

export function sportsApiKey(): string {
  return process.env.SPORTS_DATA_API_KEY || process.env.SPORTS_API_KEY || process.env.API_KEY || "";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
  }

  /** True when the upstream error is a gateway-level issue (not a client problem). */
  get isUpstreamGatewayError(): boolean {
    // 401/403 from the upstream API means our API key or gateway auth is
    // misconfigured — the *client* didn't do anything wrong.  Map these to
    // 502 so the browser doesn't think it has an auth problem.
    return [401, 403, 502, 503, 504].includes(this.status);
  }

  /** The status code the API proxy should return to the client. */
  get proxyStatus(): number {
    return this.isUpstreamGatewayError ? 502 : this.status;
  }
}

interface CachedApiEntry<T> {
  data: T;
  savedAt: number;
}

const apiCache = new Map<string, CachedApiEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function pruneApiCache(): void {
  while (apiCache.size > API.BFF_CACHE_MAX_ENTRIES) {
    const oldestKey = apiCache.keys().next().value as string | undefined;
    if (!oldestKey) return;
    apiCache.delete(oldestKey);
  }
}

function isFallbackEligible(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return err.status === 429 || err.status >= 500;
}

export function clearApiResponseCache(): void {
  apiCache.clear();
  inflight.clear();
}

// ── Double-encoded UTF-8 repair ─────────────────────────────
// Backend sometimes stores names like "Dörries" as "DÃ¶rries"
// (UTF-8 bytes decoded as Latin-1 then re-encoded as UTF-8).
// Detect and reverse that at the data boundary.

function fixMojibake(s: string): string {
  if (!/[\xc0-\xff]/.test(s)) return s;
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      if (code > 255) return s;
      bytes[i] = code;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return s;
  }
}

function deepFixStrings<T>(obj: T): T {
  if (typeof obj === "string") return fixMojibake(obj) as T;
  if (Array.isArray(obj)) return obj.map(deepFixStrings) as T;
  if (obj && typeof obj === "object") {
    const fixed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      fixed[k] = deepFixStrings(v);
    }
    return fixed as T;
  }
  return obj;
}

// ── camelCase → snake_case key normalizer ────────────────────
// Upstream FairBet endpoints return camelCase; the client still
// expects snake_case. Normalize at the proxy boundary so we don't
// have to rewrite types and every consumer.

function camelToSnakeKey(k: string): string {
  // Leave already-snake keys alone; otherwise convert fooBar → foo_bar
  return k.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

export function deepSnakeKeys<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(deepSnakeKeys) as T;
  if (obj && typeof obj === "object" && (obj as object).constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[camelToSnakeKey(k)] = deepSnakeKeys(v);
    }
    return out as T;
  }
  return obj;
}

// ── Helpers ──────────────────────────────────────────────────

/** Extract Authorization header from an incoming request to forward upstream. */
export function forwardAuth(
  req: { headers: { get(name: string): string | null } },
): Record<string, string> {
  const auth = req.headers.get("authorization");
  return auth ? { Authorization: auth } : {};
}

// ── Fetch wrapper ───────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { revalidate?: number; timeoutMs?: number },
): Promise<T> {
  const url = `${sportsApiBaseUrl()}${path}`;
  const timeoutMs = options?.timeoutMs ?? 5_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "X-API-Key": sportsApiKey(),
        "Content-Type": "application/json",
        ...options?.headers,
      },
      next:
        options?.revalidate !== undefined
          ? { revalidate: options.revalidate }
          : undefined,
    });

    if (!res.ok) {
      throw new ApiError(res.status, await res.text());
    }
    const data: T = await res.json();
    return deepFixStrings(data);
  } finally {
    clearTimeout(timer);
  }
}

export async function cachedApiFetch<T>(
  cacheKey: string,
  path: string,
  options: RequestInit & {
    revalidate?: number;
    timeoutMs?: number;
    freshMs: number;
    staleMs: number;
  },
): Promise<{ data: T; cacheStatus: "fresh" | "miss" | "stale" }> {
  const now = Date.now();
  const cached = apiCache.get(cacheKey) as CachedApiEntry<T> | undefined;
  if (cached && now - cached.savedAt < options.freshMs) {
    apiCache.delete(cacheKey);
    apiCache.set(cacheKey, cached);
    return { data: cached.data, cacheStatus: "fresh" };
  }

  let pending = inflight.get(cacheKey) as Promise<T> | undefined;
  if (!pending) {
    pending = apiFetch<T>(path, options);
    inflight.set(cacheKey, pending);
  }

  try {
    const data = await pending;
    apiCache.set(cacheKey, { data, savedAt: Date.now() });
    pruneApiCache();
    return { data, cacheStatus: "miss" };
  } catch (err) {
    if (cached && now - cached.savedAt < options.staleMs && isFallbackEligible(err)) {
      apiCache.delete(cacheKey);
      apiCache.set(cacheKey, cached);
      return { data: cached.data, cacheStatus: "stale" };
    }
    throw err;
  } finally {
    if (inflight.get(cacheKey) === pending) {
      inflight.delete(cacheKey);
    }
  }
}
