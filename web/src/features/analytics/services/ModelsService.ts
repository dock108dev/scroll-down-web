import type {
  TrainingJob,
  RegisteredModel,
  CalibrationReport,
  DegradationAlert,
} from "../types";
import { fetchApi } from "@/lib/api";

export async function startTraining(params: {
  model_type: string;
  date_start: string;
  date_end: string;
  algorithm: string;
}): Promise<void> {
  await fetchApi("/api/analytics/train", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function cancelTrainingJob(jobId: number): Promise<void> {
  await fetchApi(`/api/analytics/training-jobs?action=cancel&job_id=${encodeURIComponent(jobId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function fetchTrainingJobs(): Promise<TrainingJob[]> {
  const data = await fetchApi<{ jobs?: TrainingJob[] }>(
    "/api/analytics/training-jobs",
  );
  return data.jobs ?? [];
}

export async function fetchModelsList(): Promise<RegisteredModel[]> {
  const data = await fetchApi<{ models?: RegisteredModel[] }>(
    "/api/analytics/models-list",
  );
  return data.models ?? [];
}

export async function activateModel(
  modelId: number,
  sport: string,
  modelType: string,
): Promise<void> {
  await fetchApi("/api/analytics/models-activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sport, model_type: modelType, model_id: modelId }),
  });
}

export async function fetchCalibrationReport(): Promise<CalibrationReport | null> {
  try {
    return await fetchApi<CalibrationReport>("/api/analytics/calibration-report");
  } catch {
    return null;
  }
}

export async function fetchDegradationAlerts(): Promise<DegradationAlert[]> {
  try {
    const data = await fetchApi<{ alerts: DegradationAlert[] }>(
      "/api/analytics/degradation-alerts",
    );
    return data.alerts;
  } catch {
    return [];
  }
}
