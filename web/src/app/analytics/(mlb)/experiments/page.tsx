"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  fetchExperiments,
  createExperiment,
  fetchExperiment,
  promoteVariant,
  cancelExperiment,
  startReplay,
  fetchReplayJobs,
} from "@/features/analytics/services/ExperimentsService";
import type {
  ExperimentSuite,
  ExperimentVariant,
  ReplayJob,
} from "@/features/analytics/types";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-green-900/50 text-green-400",
    running: "bg-blue-900/50 text-blue-400",
    pending: "bg-yellow-900/50 text-yellow-400",
    failed: "bg-red-900/50 text-red-400",
    cancelled: "bg-neutral-800 text-neutral-500",
    promoted: "bg-purple-900/50 text-purple-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] ?? "bg-neutral-800 text-neutral-400"}`}>
      {status}
    </span>
  );
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<ExperimentSuite[]>([]);
  const [replayJobs, setReplayJobs] = useState<ReplayJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [variants, setVariants] = useState<ExperimentVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [paramGrid, setParamGrid] = useState("");
  const [creating, setCreating] = useState(false);

  // Replay form
  const [replayStartDate, setReplayStartDate] = useState("");
  const [replayEndDate, setReplayEndDate] = useState("");
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [exps, rj] = await Promise.all([
          fetchExperiments(),
          fetchReplayJobs(),
        ]);
        if (cancelled) return;
        setExperiments(exps);
        setReplayJobs(rj);
      } catch {
        if (!cancelled) setError("Failed to load experiments data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setVariantsLoading(true);
    try {
      const detail = await fetchExperiment(id);
      setVariants(detail.variants ?? []);
    } catch {
      setVariants([]);
    } finally {
      setVariantsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name) return;
    try {
      setCreating(true);
      setError(null);
      let gridConfig = {};
      if (paramGrid) {
        try { gridConfig = JSON.parse(paramGrid); } catch {
          setError("Invalid JSON in parameter grid.");
          setCreating(false);
          return;
        }
      }
      await createExperiment({ name, parameter_grid: gridConfig });
      const exps = await fetchExperiments();
      setExperiments(exps);
      setName("");
      setParamGrid("");
    } catch {
      setError("Failed to create experiment.");
    } finally {
      setCreating(false);
    }
  };

  const handlePromote = async (expId: string, variantId: string) => {
    try {
      await promoteVariant(expId, variantId);
      const exps = await fetchExperiments();
      setExperiments(exps);
      if (expandedId === expId) {
        const detail = await fetchExperiment(expId);
        setVariants(detail.variants ?? []);
      }
    } catch { /* ignore */ }
  };

  const handleCancel = async (expId: string) => {
    try {
      await cancelExperiment(expId);
      const exps = await fetchExperiments();
      setExperiments(exps);
    } catch { /* ignore */ }
  };

  const handleReplay = async () => {
    if (!replayStartDate || !replayEndDate) return;
    try {
      setReplaying(true);
      setError(null);
      await startReplay({ start_date: replayStartDate, end_date: replayEndDate });
      const rj = await fetchReplayJobs();
      setReplayJobs(rj);
      setReplayStartDate("");
      setReplayEndDate("");
    } catch {
      setError("Failed to start replay.");
    } finally {
      setReplaying(false);
    }
  };

  // Poll replay jobs while any are running
  useEffect(() => {
    const hasRunning = replayJobs.some((j) => j.status === "running" || j.status === "pending");
    if (!hasRunning) return;
    const interval = setInterval(async () => {
      try {
        const rj = await fetchReplayJobs();
        setReplayJobs(rj);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [replayJobs]);

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
    <AuthGate minRole="admin" message="Experiments require admin access">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-50">Experiments</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Create experiment suites, compare variants, and run historical replays.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Create Experiment ─────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
            Create Experiment
          </h2>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. feature-selection-v2"
                className="w-full text-sm rounded-lg px-3 py-2 bg-neutral-950 text-neutral-200 border border-neutral-800 outline-none placeholder:text-neutral-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-500">Parameter Grid (JSON)</label>
              <textarea
                value={paramGrid}
                onChange={(e) => setParamGrid(e.target.value)}
                rows={3}
                placeholder='{"iterations": [5000, 10000], "probability_mode": ["ml", "ensemble"]}'
                className="w-full text-sm rounded-lg px-3 py-2 bg-neutral-950 text-neutral-200 border border-neutral-800 outline-none placeholder:text-neutral-600 font-mono"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!name || creating}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Creating..." : "Create Experiment"}
            </button>
          </div>
        </section>

        {/* ── Experiment Suites ─────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
            Suites
          </h2>
          {experiments.length === 0 ? (
            <p className="text-sm text-neutral-500">No experiments.</p>
          ) : (
            <div className="space-y-2">
              {experiments.map((exp) => (
                <div key={exp.id} className="rounded-lg border border-neutral-800 bg-neutral-900">
                  <button
                    onClick={() => handleExpand(exp.id)}
                    className="w-full px-4 py-3 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-200">{exp.name}</span>
                        <StatusBadge status={exp.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">
                          {exp.variant_count} variants
                        </span>
                        {(exp.status === "running" || exp.status === "pending") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCancel(exp.id); }}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      Created {new Date(exp.created_at).toLocaleDateString()}
                    </p>
                  </button>

                  {expandedId === exp.id && (
                    <div className="px-4 pb-3 border-t border-neutral-800 pt-3">
                      {variantsLoading ? (
                        <div className="h-12 bg-neutral-800 rounded animate-pulse" />
                      ) : variants.length === 0 ? (
                        <p className="text-xs text-neutral-500">No variants.</p>
                      ) : (
                        <div className="space-y-2">
                          {variants
                            .sort((a, b) => (b.metrics?.accuracy ?? 0) - (a.metrics?.accuracy ?? 0))
                            .map((v) => (
                              <div key={v.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-neutral-200">{v.name}</span>
                                  <StatusBadge status={v.status} />
                                </div>
                                <div className="flex items-center gap-3">
                                  {v.metrics && (
                                    <span className="text-neutral-400">
                                      Acc: {(v.metrics.accuracy * 100).toFixed(1)}%
                                    </span>
                                  )}
                                  {v.status === "completed" && exp.status === "completed" && (
                                    <button
                                      onClick={() => handlePromote(exp.id, v.id)}
                                      className="text-blue-400 hover:text-blue-300"
                                    >
                                      Promote
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Historical Replay ─────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
            Historical Replay
          </h2>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500">Start Date</label>
                <input
                  type="date"
                  value={replayStartDate}
                  onChange={(e) => setReplayStartDate(e.target.value)}
                  className="w-full text-sm rounded-lg px-3 py-2 bg-neutral-950 text-neutral-200 border border-neutral-800 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500">End Date</label>
                <input
                  type="date"
                  value={replayEndDate}
                  onChange={(e) => setReplayEndDate(e.target.value)}
                  className="w-full text-sm rounded-lg px-3 py-2 bg-neutral-950 text-neutral-200 border border-neutral-800 outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleReplay}
              disabled={!replayStartDate || !replayEndDate || replaying}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {replaying ? "Starting..." : "Start Replay"}
            </button>
          </div>

          {replayJobs.length > 0 && (
            <div className="space-y-2">
              {replayJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-200">
                        {job.start_date} → {job.end_date}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    <span className="text-xs text-neutral-500">
                      {job.games_processed}/{job.games_total} games
                    </span>
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
