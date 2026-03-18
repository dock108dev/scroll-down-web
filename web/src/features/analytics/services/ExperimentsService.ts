import type {
  ExperimentSuite,
  ExperimentDetail,
  ReplayJob,
} from "../types";
import { fetchApi } from "@/lib/api";

export async function fetchExperiments(): Promise<ExperimentSuite[]> {
  const data = await fetchApi<{ experiments: ExperimentSuite[] }>(
    "/api/analytics/experiments",
  );
  return data.experiments;
}

export async function createExperiment(body: {
  name: string;
  parameter_grid: Record<string, unknown>;
}): Promise<void> {
  await fetchApi("/api/analytics/experiments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchExperiment(id: string): Promise<ExperimentDetail> {
  return fetchApi<ExperimentDetail>(
    `/api/analytics/experiments/${encodeURIComponent(id)}`,
  );
}

export async function promoteVariant(
  experimentId: string,
  variantId: string,
): Promise<void> {
  await fetchApi(
    `/api/analytics/experiments/${encodeURIComponent(experimentId)}/promote/${encodeURIComponent(variantId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

export async function cancelExperiment(id: string): Promise<void> {
  await fetchApi(
    `/api/analytics/experiments/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

export async function startReplay(body: {
  start_date: string;
  end_date: string;
}): Promise<void> {
  await fetchApi("/api/analytics/replay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchReplayJobs(): Promise<ReplayJob[]> {
  const data = await fetchApi<{ jobs: ReplayJob[] }>(
    "/api/analytics/replay-jobs",
  );
  return data.jobs;
}
