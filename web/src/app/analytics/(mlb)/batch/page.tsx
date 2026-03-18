"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { StatusBadge } from "@/features/analytics/components/StatusBadge";
import {
  startBatchSimulation,
  fetchBatchJobs,
  recordOutcomes,
  fetchPredictionOutcomes,
} from "@/features/analytics/services/BatchService";
import { fetchModelsList, fetchTrainingJobs } from "@/features/analytics/services/ModelsService";
import type { BatchJob, PredictionOutcome, RegisteredModel, TrainingJob } from "@/features/analytics/types";

function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(0)}%`;
}

export default function BatchPage() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [outcomes, setOutcomes] = useState<PredictionOutcome[]>([]);
  const [models, setModels] = useState<RegisteredModel[]>([]);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);

  // Form state
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [modelId, setModelId] = useState("");
  const [iterations, setIterations] = useState("5000");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [j, o, m, t] = await Promise.all([
          fetchBatchJobs(),
          fetchPredictionOutcomes(),
          fetchModelsList(),
          fetchTrainingJobs(),
        ]);
        if (cancelled) return;
        setJobs(j);
        setOutcomes(o);
        setModels(m);
        setTrainingJobs(t);
      } catch {
        if (!cancelled) setError("Failed to load batch data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Poll jobs while any are running
  useEffect(() => {
    const hasRunning = jobs.some((j) => ["running", "pending", "queued"].includes(j.status));
    if (!hasRunning) return;
    const interval = setInterval(async () => {
      try {
        const j = await fetchBatchJobs();
        setJobs(j);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [jobs]);

  // Build model options: active models + completed training jobs
  const activeModel = models.find((m) => m.is_active);
  const completedTrainingModels = trainingJobs
    .filter((t) => t.status === "completed" && t.id)
    .map((t) => t.id);
  const modelOptions = models.filter((m) => m.is_active || completedTrainingModels.includes(m.id));
  const availableModels = modelOptions.length > 0 ? modelOptions : models;

  const handleLaunch = async () => {
    if (!dateStart || !dateEnd) return;
    try {
      setSubmitting(true);
      setError(null);
      await startBatchSimulation({
        sport: "mlb",
        date_start: dateStart,
        date_end: dateEnd,
        model_id: modelId || undefined,
        iterations: parseInt(iterations) || 5000,
      });
      const j = await fetchBatchJobs();
      setJobs(j);
      setDateStart("");
      setDateEnd("");
      setModelId("");
    } catch {
      setError("Failed to start batch simulation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordOutcomes = async () => {
    try {
      setRecording(true);
      await recordOutcomes();
      const o = await fetchPredictionOutcomes();
      setOutcomes(o);
    } catch {
      setError("Failed to record outcomes.");
    } finally {
      setRecording(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-neutral-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <AuthGate minRole="admin" message="Batch simulations require admin access">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-50">Batch Sims</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Run batch simulations, track jobs, and record prediction outcomes.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Launch ────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
            Launch Batch Simulation
          </h2>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500">Start Date</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="w-full text-sm rounded-lg px-3 py-2 bg-neutral-950 text-neutral-200 border border-neutral-800 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500">End Date</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full text-sm rounded-lg px-3 py-2 bg-neutral-950 text-neutral-200 border border-neutral-800 outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500">Model</label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full text-sm rounded-lg px-3 py-2 bg-neutral-950 text-neutral-200 border border-neutral-800 outline-none"
                >
                  <option value="">Active model{activeModel ? ` (${activeModel.name})` : ""}</option>
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} v{m.version}{m.is_active ? " (active)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500">Iterations</label>
                <input
                  type="number"
                  value={iterations}
                  onChange={(e) => setIterations(e.target.value)}
                  className="w-full text-sm rounded-lg px-3 py-2 bg-neutral-950 text-neutral-200 border border-neutral-800 outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleLaunch}
              disabled={!dateStart || !dateEnd || submitting}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Starting..." : "Start Batch"}
            </button>
          </div>
        </section>

        {/* ── Jobs ──────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
            Jobs
          </h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-neutral-500">No batch jobs.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const dateLabel = [job.date_start, job.date_end].filter(Boolean).join(" → ") || "—";
                return (
                  <div key={job.id} className="rounded-lg border border-neutral-800 bg-neutral-900">
                    <button
                      onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                      className="w-full px-4 py-3 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-neutral-200">{dateLabel}</span>
                          <StatusBadge status={job.status} />
                        </div>
                        <span className="text-xs text-neutral-500">
                          {job.game_count ?? 0} games &middot; {(job.iterations ?? 0).toLocaleString()} iter
                        </span>
                      </div>
                    </button>
                    {expandedJob === job.id && (
                      <div className="px-4 pb-3 border-t border-neutral-800 pt-3 space-y-2">
                        {job.error_message && (
                          <p className="text-xs text-red-400">{job.error_message}</p>
                        )}
                        {job.batch_summary && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-neutral-500">Home Win Rate</span>
                              <div className="text-neutral-200 font-medium">
                                {fmtPct(job.batch_summary.home_win_rate)}
                              </div>
                            </div>
                            <div>
                              <span className="text-neutral-500">Avg Total</span>
                              <div className="text-neutral-200 font-medium">
                                {job.batch_summary.avg_total_per_game?.toFixed(1) ?? "—"}
                              </div>
                            </div>
                            <div>
                              <span className="text-neutral-500">Avg Runs/Team</span>
                              <div className="text-neutral-200 font-medium">
                                {job.batch_summary.avg_runs_per_team?.toFixed(1) ?? "—"}
                              </div>
                            </div>
                          </div>
                        )}
                        {job.warnings && job.warnings.length > 0 && (
                          <div className="text-xs text-amber-400 space-y-1">
                            {job.warnings.map((w, i) => (
                              <p key={i}>{w}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Outcomes ──────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Prediction Outcomes
            </h2>
            <button
              onClick={handleRecordOutcomes}
              disabled={recording}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 transition-colors"
            >
              {recording ? "Recording..." : "Record Outcomes"}
            </button>
          </div>
          {outcomes.length === 0 ? (
            <p className="text-sm text-neutral-500">No prediction outcomes recorded.</p>
          ) : (
            <div className="space-y-2">
              {outcomes.slice(0, 20).map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm text-neutral-200">
                      {o.away_team} @ {o.home_team}
                    </span>
                    <span className="text-xs text-neutral-500 ml-2">{o.game_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">
                      Pred: {fmtPct(o.predicted_home_wp)}
                    </span>
                    {o.correct_winner != null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        o.correct_winner ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
                      }`}>
                        {o.correct_winner ? "Correct" : "Incorrect"}
                      </span>
                    )}
                    {o.correct_winner == null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-500">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AuthGate>
  );
}
