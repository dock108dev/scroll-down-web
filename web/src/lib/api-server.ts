import { BACKEND_BASE_URL } from "@/lib/config";

// Server-side fetches prefer the internal Docker URL (avoids hairpin NAT).
export const BASE_URL = process.env.SPORTS_API_INTERNAL_URL || BACKEND_BASE_URL;
const API_KEY = process.env.SPORTS_DATA_API_KEY || process.env.SPORTS_API_KEY || process.env.API_KEY || "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
  }
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
  options?: RequestInit & { revalidate?: number },
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "X-API-Key": API_KEY,
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
}
