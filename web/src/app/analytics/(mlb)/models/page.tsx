"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { StatusBadge } from "@/features/analytics/components/StatusBadge";
import {
  fetchFeatureConfigs,
  fetchAvailableFeatures,
  fetchTrainingJobs,
  startTraining,
  cancelTrainingJob,
  fetchModelsList,
  activateModel,
  fetchCalibrationReport,
  fetchDegradationAlerts,
} from "@/features/analytics/services/ModelsService";
import type {
  FeatureConfig,
  AvailableFeature,
  TrainingJob,
  RegisteredModel,
  CalibrationReport,
  DegradationAlert,
} from "@/features/analytics/types";

export default function ModelsPage() {
  const [featureConfigs, setFeatureConfigs] = useState<FeatureConfig[]>([]);
  const [availableFeatures, setAvailableFeatures] = useState<AvailableFeature[]>([]);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [models, setModels] = useState<RegisteredModel[]>([]);
  const [calibration, setCalibration] = useState<CalibrationReport | null>(null);
  const [alerts, setAlerts] = useState<DegradationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trainingInProgress, setTrainingInProgress] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [fc, af, tj, ml, cr, da] = await Promise.all([
          fetchFeatureConfigs(),
          fetchAvailableFeatures(),
          fetchTrainingJobs(),
          fetchModelsList(),
          fetchCalibrationReport(),
          fetchDegradationAlerts(),
        ]);
        if (cancelled) return;
        setFeatureConfigs(fc);
        setAvailableFeatures(af);
        setTrainingJobs(tj);
        setModels(ml);
        setCalibration(cr);
        setAlerts(da);
      } catch {
        if (!cancelled) setError("Failed to load models data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Poll training jobs while any are running
  useEffect(() => {
    const hasRunning = trainingJobs.some((j) => j.status === "running" || j.status === "pending");
    if (!hasRunning) return;
    const interval = setInterval(async () => {
      try {
        const tj = await fetchTrainingJobs();
        setTrainingJobs(tj);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [trainingJobs]);

  const handleStartTraining = async () => {
    try {
      setTrainingInProgress(true);
      await startTraining();
      const tj = await fetchTrainingJobs();
      setTrainingJobs(tj);
    } catch {
      setError("Failed to start training.");
    } finally {
      setTrainingInProgress(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelTrainingJob(jobId);
      const tj = await fetchTrainingJobs();
      setTrainingJobs(tj);
    } catch { /* ignore */ }
  };

  const handleActivateModel = async (modelId: string) => {
    try {
      await activateModel(modelId);
      const ml = await fetchModelsList();
      setModels(ml);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-neutral-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <AuthGate minRole="admin" message="Models management requires admin access">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-50">Models</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Feature loadouts, training, model registry, and performance monitoring.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Feature Loadouts ──────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
            Feature Loadouts
          </h2>
          {featureConfigs.length === 0 ? (
            <p className="text-sm text-neutral-500">No feature configs found.</p>
          ) : (
            <div className="space-y-2">
              {featureConfigs.map((fc) => (
                <div
                  key={fc.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-200">{fc.name}</span>
                    {fc.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400">
                        active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {fc.feature_count} features &middot; Created {new Date(fc.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {availableFeatures.length > 0 && (
            <details className="text-sm">
              <summary className="text-neutral-400 cursor-pointer hover:text-neutral-300">
                Available features ({availableFeatures.length})
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {availableFeatures.map((f) => (
                  <span key={f.name} className="text-xs text-neutral-500 truncate">
                    {f.name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* ── Training ──────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Training
            </h2>
            <button
              onClick={handleStartTraining}
              disabled={trainingInProgress}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {trainingInProgress ? "Starting..." : "Start Training"}
            </button>
          </div>
          {trainingJobs.length === 0 ? (
            <p className="text-sm text-neutral-500">No training jobs.</p>
          ) : (
            <div className="space-y-2">
              {trainingJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-200">{job.id}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    {(job.status === "running" || job.status === "pending") && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Started {new Date(job.created_at).toLocaleString()}
                    {job.metrics && ` · Accuracy: ${(job.metrics.accuracy * 100).toFixed(1)}%`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Model Registry ────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
            Registry
          </h2>
          {models.length === 0 ? (
            <p className="text-sm text-neutral-500">No registered models.</p>
          ) : (
            <div className="space-y-2">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-neutral-200">{m.name}</span>
                      <span className="text-xs text-neutral-500 ml-2">v{m.version}</span>
                    </div>
                    <button
                      onClick={() => handleActivateModel(m.id)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        m.is_active
                          ? "bg-green-900/50 text-green-400"
                          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                      }`}
                    >
                      {m.is_active ? "Active" : "Activate"}
                    </button>
                  </div>
                  {m.metrics && (
                    <p className="text-xs text-neutral-500 mt-1">
                      Accuracy: {(m.metrics.accuracy * 100).toFixed(1)}%
                      {m.metrics.brier_score !== undefined && ` · Brier: ${m.metrics.brier_score.toFixed(4)}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Performance ───────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
            Performance
          </h2>

          {calibration && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 space-y-2">
              <h3 className="text-sm font-medium text-neutral-200">Calibration Report</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {calibration.buckets.map((b) => (
                  <div key={b.range} className="text-center">
                    <div className="text-neutral-400">{b.range}</div>
                    <div className="text-neutral-200 font-medium">{(b.actual_rate * 100).toFixed(1)}%</div>
                    <div className="text-neutral-500">n={b.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-200">Degradation Alerts</h3>
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-amber-800/50 bg-amber-900/10 px-4 py-3"
                >
                  <div className="text-sm text-amber-400">{a.metric}</div>
                  <p className="text-xs text-neutral-400 mt-1">{a.message}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {new Date(a.detected_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!calibration && alerts.length === 0 && (
            <p className="text-sm text-neutral-500">No performance data available.</p>
          )}
        </section>
      </div>
    </AuthGate>
  );
}
