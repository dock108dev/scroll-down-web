import type { ForecastsResponse } from "../types";
import { fetchApi } from "@/lib/api";

export async function fetchForecasts(opts?: {
  date?: string;
  minEdge?: number;
}): Promise<ForecastsResponse> {
  const params = new URLSearchParams();
  if (opts?.date) params.set("date", opts.date);
  if (opts?.minEdge != null) params.set("min_edge", String(opts.minEdge));
  const qs = params.toString();
  return fetchApi<ForecastsResponse>(
    `/api/analytics/forecasts/mlb${qs ? `?${qs}` : ""}`,
  );
}
