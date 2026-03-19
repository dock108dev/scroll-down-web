"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { StatusBadge } from "@/features/analytics/components/StatusBadge";
import {
  startBatchSimulation,
  fetchBatchJobs,
  fetchBatchJobDetail,
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
  const [models, setModels] = useState<RegisteredModel[]>([]);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [jobDetails, setJobDetails] = useState<Record<number, BatchJob>>({});
  const [jobOutcomes, setJobOutcomes] = useState<Record<number, PredictionOutcome[]>>({});
  const [outcomesLoading, setOutcomesLoading] = useState<Record<number, boolean>>({});
  const [expandedOutcome, setExpandedOutcome] = useState<number | null>(null);

  // Form state
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [modelId, setModelId] = useState("");
  const [iterations, setIterations] = useState("5000");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [j, m, t] = await Promise.all([
          fetchBatchJobs(),
          fetchModelsList(),
          fetchTrainingJobs(),
        ]);
        if (cancelled) return;
        setJobs(j);
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
  const activeModel = models.find((m) => m.active);
  const completedTrainingModels = trainingJobs
    .filter((t) => t.status === "completed" && t.model_id)
    .map((t) => t.model_id);
  const modelOptions = models.filter((m) => m.active || completedTrainingModels.includes(m.model_id));
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
        probability_mode: "pitch_level",
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

  const handleExpandJob = async (jobId: number) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobId);
    setExpandedOutcome(null);

    // Fetch job detail if not cached
    if (!jobDetails[jobId]) {
      try {
        const detail = await fetchBatchJobDetail(jobId);
        setJobDetails((prev) => ({ ...prev, [jobId]: detail }));
      } catch { /* ignore */ }
    }

    // Fetch per-job outcomes if not cached
    if (!jobOutcomes[jobId]) {
      setOutcomesLoading((prev) => ({ ...prev, [jobId]: true }));
      try {
        const outcomes = await fetchPredictionOutcomes(jobId);
        setJobOutcomes((prev) => ({ ...prev, [jobId]: outcomes }));
      } catch { /* ignore */ }
      finally {
        setOutcomesLoading((prev) => ({ ...prev, [jobId]: false }));
      }
    }
  };

  const handleRecordOutcomes = async () => {
    try {
      setRecording(true);
      await recordOutcomes();
      // Clear cached outcomes so they reload on next expand
      setJobOutcomes({});
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
            Run batch simulations, track jobs, and review per-game results.
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
                  <option value="">Active model{activeModel ? ` (${activeModel.model_type} v${activeModel.version})` : ""}</option>
                  {availableModels.map((m) => (
                    <option key={m.model_id} value={m.model_id}>
                      {m.model_type} v{m.version}{m.active ? " (active)" : ""}
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Jobs
            </h2>
            <button
              onClick={handleRecordOutcomes}
              disabled={recording}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 transition-colors"
            >
              {recording ? "Recording..." : "Record Outcomes"}
            </button>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-neutral-500">No batch jobs.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const dateLabel = [job.date_start, job.date_end].filter(Boolean).join(" → ") || "—";
                const detail = jobDetails[job.id] ?? job;
                const outcomes = jobOutcomes[job.id] ?? [];
                const loadingOutcomes = outcomesLoading[job.id] ?? false;
                return (
                  <div key={job.id} className="rounded-lg border border-neutral-800 bg-neutral-900">
                    <button
                      onClick={() => handleExpandJob(job.id)}
                      className="w-full px-4 py-3 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-neutral-200">{dateLabel}</span>
                          <StatusBadge status={job.status} />
                        </div>
                        <span className="text-xs text-neutral-500">
                          {job.game_count ?? 0} games &middot; {(job.iterations ?? 0).toLocaleString()} iter
                          {expandedJob === job.id ? " ▲" : " ▼"}
                        </span>
                      </div>
                    </button>
                    {expandedJob === job.id && (
                      <div className="px-4 pb-3 border-t border-neutral-800 pt-3 space-y-3">
                        {detail.error_message && (
                          <p className="text-xs text-red-400">{detail.error_message}</p>
                        )}
                        {detail.batch_summary && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-neutral-500">Home Win Rate</span>
                              <div className="text-neutral-200 font-medium">
                                {fmtPct(detail.batch_summary.home_win_rate)}
                              </div>
                            </div>
                            <div>
                              <span className="text-neutral-500">Avg Total</span>
                              <div className="text-neutral-200 font-medium">
                                {detail.batch_summary.avg_total_per_game?.toFixed(1) ?? "—"}
                              </div>
                            </div>
                            <div>
                              <span className="text-neutral-500">Avg Runs/Team</span>
                              <div className="text-neutral-200 font-medium">
                                {detail.batch_summary.avg_runs_per_team?.toFixed(1) ?? "—"}
                              </div>
                            </div>
                          </div>
                        )}
                        {detail.warnings && detail.warnings.length > 0 && (
                          <div className="text-xs text-amber-400 space-y-1">
                            {detail.warnings.map((w, i) => (
                              <p key={i}>{w}</p>
                            ))}
                          </div>
                        )}

                        {/* Per-game results */}
                        {loadingOutcomes && (
                          <div className="space-y-1">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <div key={i} className="h-8 bg-neutral-800 rounded animate-pulse" />
                            ))}
                          </div>
                        )}
                        {!loadingOutcomes && outcomes.length > 0 && (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              Game Results ({outcomes.length})
                            </h4>
                            <div className="space-y-1 max-h-80 overflow-y-auto">
                              {outcomes.map((o) => (
                                <button
                                  key={o.id}
                                  onClick={() => setExpandedOutcome(expandedOutcome === o.id ? null : o.id)}
                                  className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-left hover:border-neutral-700 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-neutral-400">{o.game_date}</span>
                                      <span className="text-sm text-neutral-200">
                                        {o.away_team} @ {o.home_team}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-neutral-400">
                                        Pred: {fmtPct(o.predicted_home_wp)}
                                      </span>
                                      {o.correct_winner != null ? (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                          o.correct_winner ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
                                        }`}>
                                          {o.correct_winner ? "Correct" : "Wrong"}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-500">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {expandedOutcome === o.id && (
                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-neutral-800 text-xs">
                                      <div>
                                        <span className="text-neutral-500">Predicted Score</span>
                                        <div className="text-neutral-200">
                                          {o.predicted_away_score?.toFixed(1) ?? "—"} – {o.predicted_home_score?.toFixed(1) ?? "—"}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-neutral-500">Actual Score</span>
                                        <div className="text-neutral-200">
                                          {o.actual_away_score ?? "—"} – {o.actual_home_score ?? "—"}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-neutral-500">Away WP</span>
                                        <div className="text-neutral-200">{fmtPct(o.predicted_away_wp)}</div>
                                      </div>
                                      <div>
                                        <span className="text-neutral-500">Brier Score</span>
                                        <div className="text-neutral-200">{o.brier_score?.toFixed(4) ?? "—"}</div>
                                      </div>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {!loadingOutcomes && job.status === "completed" && outcomes.length === 0 && (
                          <p className="text-xs text-neutral-500">
                            No outcomes recorded yet. Click &ldquo;Record Outcomes&rdquo; to score predictions against actual results.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AuthGate>
  );
}
