import type {
  FeatureConfig,
  AvailableFeature,
  TrainingJob,
  RegisteredModel,
  CalibrationReport,
  DegradationAlert,
} from "../types";
import { fetchApi } from "@/lib/api";

export async function fetchFeatureConfigs(): Promise<FeatureConfig[]> {
  const data = await fetchApi<{ configs: FeatureConfig[] }>(
    "/api/analytics/feature-configs",
  );
  return data.configs;
}

export async function fetchAvailableFeatures(): Promise<AvailableFeature[]> {
  const data = await fetchApi<{ features: AvailableFeature[] }>(
    "/api/analytics/available-features",
  );
  return data.features;
}

export async function startTraining(): Promise<void> {
  await fetchApi("/api/analytics/train", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function cancelTrainingJob(jobId: string): Promise<void> {
  await fetchApi(`/api/analytics/training-jobs?action=cancel&job_id=${encodeURIComponent(jobId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function fetchTrainingJobs(): Promise<TrainingJob[]> {
  const data = await fetchApi<{ jobs: TrainingJob[] }>(
    "/api/analytics/training-jobs",
  );
  return data.jobs;
}

export async function fetchModelsList(): Promise<RegisteredModel[]> {
  const data = await fetchApi<{ models: RegisteredModel[] }>(
    "/api/analytics/models-list",
  );
  return data.models;
}

export async function activateModel(modelId: string): Promise<void> {
  await fetchApi("/api/analytics/models-activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: modelId }),
  });
}

export async function fetchCalibrationReport(): Promise<CalibrationReport> {
  return fetchApi<CalibrationReport>("/api/analytics/calibration-report");
}

export async function fetchDegradationAlerts(): Promise<DegradationAlert[]> {
  const data = await fetchApi<{ alerts: DegradationAlert[] }>(
    "/api/analytics/degradation-alerts",
  );
  return data.alerts;
}
