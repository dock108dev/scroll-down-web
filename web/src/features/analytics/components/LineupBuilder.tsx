"use client";

import { useCallback } from "react";
import type { RosterBatter, RosterPitcher, LineupSlot, PitcherSlot } from "../types";

// ─── Batter Lineup ──────────────────────────────────────────

interface LineupBuilderProps {
  label: string;
  batters: RosterBatter[];
  pitchers: RosterPitcher[];
  lineup: LineupSlot[];
  starter: PitcherSlot | null;
  onLineupChange: (lineup: LineupSlot[]) => void;
  onStarterChange: (starter: PitcherSlot | null) => void;
  loading?: boolean;
}

export function LineupBuilder({
  label,
  batters,
  pitchers,
  lineup,
  starter,
  onLineupChange,
  onStarterChange,
  loading,
}: LineupBuilderProps) {
  const usedRefs = new Set(lineup.map((s) => s.external_ref));

  const setSlot = useCallback(
    (index: number, ref: string) => {
      const batter = batters.find((b) => b.external_ref === ref);
      if (!batter) return;
      const next = [...lineup];
      next[index] = { external_ref: batter.external_ref, name: batter.name };
      onLineupChange(next);
    },
    [batters, lineup, onLineupChange],
  );

  const clearSlot = useCallback(
    (index: number) => {
      const next = [...lineup];
      next[index] = { external_ref: "", name: "" };
      onLineupChange(next);
    },
    [lineup, onLineupChange],
  );

  if (loading) {
    return (
      <div className="space-y-2">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          {label}
        </span>
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 bg-neutral-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
        {label}
      </span>

      {/* Starter Pitcher */}
      <div className="space-y-1">
        <label className="text-[11px] text-neutral-600">Starting Pitcher</label>
        <select
          value={starter?.external_ref ?? ""}
          onChange={(e) => {
            const p = pitchers.find((p) => p.external_ref === e.target.value);
            onStarterChange(p ? { external_ref: p.external_ref, name: p.name, avg_ip: p.avg_ip } : null);
          }}
          className="w-full text-xs rounded-md px-2 py-1.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none"
        >
          <option value="">Select pitcher</option>
          {pitchers.map((p) => (
            <option key={p.external_ref} value={p.external_ref}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Batting Order */}
      <div className="space-y-1">
        <label className="text-[11px] text-neutral-600">Batting Order</label>
        <div className="space-y-1">
          {lineup.map((slot, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-600 w-4 text-right shrink-0">
                {i + 1}
              </span>
              <select
                value={slot.external_ref}
                onChange={(e) => {
                  if (e.target.value === "") {
                    clearSlot(i);
                  } else {
                    setSlot(i, e.target.value);
                  }
                }}
                className="flex-1 text-xs rounded-md px-2 py-1.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none min-w-0"
              >
                <option value="">—</option>
                {batters.map((b) => {
                  const taken = usedRefs.has(b.external_ref) && slot.external_ref !== b.external_ref;
                  return (
                    <option
                      key={b.external_ref}
                      value={b.external_ref}
                      disabled={taken}
                    >
                      {b.name}{taken ? " (in lineup)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
