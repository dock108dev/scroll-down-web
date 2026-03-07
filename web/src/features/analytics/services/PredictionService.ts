import type { PitchModelResponse, RunExpectancyResponse } from "../types";

const pitchCache = new Map<string, { data: PitchModelResponse; ts: number }>();
const reCache = new Map<string, { data: RunExpectancyResponse; ts: number }>();
const CACHE_TTL = 10_000; // 10s

function isFresh(ts: number): boolean {
  return Date.now() - ts < CACHE_TTL;
}

export async function getPitchPrediction(params: {
  pitcher_k_rate?: number;
  batter_contact_rate?: number;
  count_balls?: number;
  count_strikes?: number;
}): Promise<PitchModelResponse> {
  const key = JSON.stringify(params);
  const cached = pitchCache.get(key);
  if (cached && isFresh(cached.ts)) return cached.data;

  const qs = new URLSearchParams();
  if (params.pitcher_k_rate != null)
    qs.set("pitcher_k_rate", String(params.pitcher_k_rate));
  if (params.batter_contact_rate != null)
    qs.set("batter_contact_rate", String(params.batter_contact_rate));
  if (params.count_balls != null)
    qs.set("count_balls", String(params.count_balls));
  if (params.count_strikes != null)
    qs.set("count_strikes", String(params.count_strikes));

  const res = await fetch(`/api/analytics/mlb/pitch-model?${qs}`);
  if (!res.ok) throw new Error(`Pitch model failed: ${res.status}`);

  const data: PitchModelResponse = await res.json();
  pitchCache.set(key, { data, ts: Date.now() });
  return data;
}

export async function getRunExpectancy(params: {
  base_state?: number;
  outs?: number;
  batter_quality?: number;
  pitcher_quality?: number;
}): Promise<RunExpectancyResponse> {
  const key = JSON.stringify(params);
  const cached = reCache.get(key);
  if (cached && isFresh(cached.ts)) return cached.data;

  const qs = new URLSearchParams();
  if (params.base_state != null)
    qs.set("base_state", String(params.base_state));
  if (params.outs != null) qs.set("outs", String(params.outs));
  if (params.batter_quality != null)
    qs.set("batter_quality", String(params.batter_quality));
  if (params.pitcher_quality != null)
    qs.set("pitcher_quality", String(params.pitcher_quality));

  const res = await fetch(`/api/analytics/mlb/run-expectancy?${qs}`);
  if (!res.ok) throw new Error(`Run expectancy failed: ${res.status}`);

  const data: RunExpectancyResponse = await res.json();
  reCache.set(key, { data, ts: Date.now() });
  return data;
}
