/**
 * Lightweight localStorage cache for API responses.
 * Used to provide stale-data fallback when the backend is unavailable.
 */

interface CacheEntry<T> {
  data: T;
  savedAt: number;
}

/** Read a cached value from localStorage. Returns null if missing or unparseable. */
export function readCache<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (!entry.data || !entry.savedAt) return null;
    return entry;
  } catch {
    return null;
  }
}

/** Write a value to localStorage cache with a timestamp. */
export function writeCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { data, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage access denied — silently ignore
  }
}
