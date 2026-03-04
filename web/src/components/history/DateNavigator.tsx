"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

// ── Date helpers (US/Eastern) ──────────────────────────────

function easternToday(): Date {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  now.setHours(0, 0, 0, 0);
  return now;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortLabel(dateStr: string): string {
  const today = easternToday();
  const yesterday = addDays(today, -1);
  if (dateStr === fmt(today)) return "Today";
  if (dateStr === fmt(yesterday)) return "Yesterday";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Presets ────────────────────────────────────────────────

interface Preset {
  label: string;
  getRange: () => [string, string];
}

function getPresets(): Preset[] {
  const today = easternToday();
  return [
    {
      label: "Yesterday",
      getRange: () => {
        const d = fmt(addDays(today, -1));
        return [d, d];
      },
    },
    {
      label: "Last 7 days",
      getRange: () => [fmt(addDays(today, -6)), fmt(today)],
    },
    {
      label: "Last 30 days",
      getRange: () => [fmt(addDays(today, -29)), fmt(today)],
    },
  ];
}

// ── Component ──────────────────────────────────────────────

interface DateNavigatorProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (startDate: string, endDate: string) => void;
  loading?: boolean;
}

export function DateNavigator({ startDate, endDate, onChange, loading }: DateNavigatorProps) {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const todayStr = fmt(easternToday());
  const presets = getPresets();

  const isPresetActive = (preset: Preset) => {
    const [s, e] = preset.getRange();
    return s === startDate && e === endDate;
  };

  return (
    <div className="space-y-2">
      {/* Date range inputs */}
      <div className="flex items-center gap-2">
        {/* Start date */}
        <button
          onClick={() => startRef.current?.showPicker()}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-800/70 px-3 py-1.5 text-sm text-neutral-50 hover:bg-neutral-700 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {shortLabel(startDate)}
        </button>

        <span className="text-xs text-neutral-500">to</span>

        {/* End date */}
        <button
          onClick={() => endRef.current?.showPicker()}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-800/70 px-3 py-1.5 text-sm text-neutral-50 hover:bg-neutral-700 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {shortLabel(endDate)}
        </button>

        {/* Hidden native date pickers */}
        <input
          ref={startRef}
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => {
            const val = e.target.value;
            if (val && val <= endDate) onChange(val, endDate);
          }}
          className="absolute w-0 h-0 opacity-0 pointer-events-none"
          tabIndex={-1}
        />
        <input
          ref={endRef}
          type="date"
          value={endDate}
          min={startDate}
          max={todayStr}
          onChange={(e) => {
            const val = e.target.value;
            if (val && val >= startDate && val <= todayStr) onChange(startDate, val);
          }}
          className="absolute w-0 h-0 opacity-0 pointer-events-none"
          tabIndex={-1}
        />
      </div>

      {/* Preset pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              const [s, e] = preset.getRange();
              onChange(s, e);
            }}
            disabled={loading}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition",
              isPresetActive(preset)
                ? "bg-neutral-50 text-neutral-950"
                : "bg-neutral-800 text-neutral-400 hover:text-neutral-50",
              loading && "opacity-50 cursor-not-allowed",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
