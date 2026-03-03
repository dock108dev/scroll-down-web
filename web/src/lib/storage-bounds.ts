/**
 * Pruning utility for localStorage-persisted records.
 * Caps growth by removing the oldest entries beyond maxEntries or maxAgeMs.
 */
export function pruneByAge<T extends { savedAt?: string }>(
  records: Record<string | number, T>,
  maxEntries: number,
  maxAgeMs: number,
): Record<string | number, T> {
  const now = Date.now();
  const entries = Object.entries(records)
    .map(([key, value]) => ({
      key,
      value,
      age: value.savedAt ? now - new Date(value.savedAt).getTime() : 0,
    }))
    .filter((e) => e.age < maxAgeMs)
    .sort((a, b) => a.age - b.age);

  const pruned: Record<string | number, T> = {};
  for (const entry of entries.slice(0, maxEntries)) {
    pruned[entry.key] = entry.value;
  }
  return pruned;
}
