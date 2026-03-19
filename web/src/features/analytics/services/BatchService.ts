import type {
  BatchSimRequest,
  BatchJob,
  PredictionOutcome,
} from "../types";
import { fetchApi } from "@/lib/api";

export async function startBatchSimulation(
  request: BatchSimRequest,
): Promise<void> {
  await fetchApi("/api/analytics/batch-simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function fetchBatchJobs(): Promise<BatchJob[]> {
  const data = await fetchApi<{ jobs?: BatchJob[] }>(
    "/api/analytics/batch-simulate-jobs",
  );
  return data.jobs ?? [];
}

export async function fetchBatchJobDetail(jobId: number): Promise<BatchJob> {
  return fetchApi<BatchJob>(`/api/analytics/batch-simulate-job/${jobId}`);
}

export async function recordOutcomes(): Promise<void> {
  await fetchApi("/api/analytics/record-outcomes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function fetchPredictionOutcomes(batchJobId?: number): Promise<PredictionOutcome[]> {
  const qs = batchJobId != null ? `?batch_sim_job_id=${batchJobId}` : "";
  const data = await fetchApi<{ outcomes?: PredictionOutcome[] }>(
    `/api/analytics/prediction-outcomes${qs}`,
  );
  return data.outcomes ?? [];
}
