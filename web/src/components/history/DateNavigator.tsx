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

function smartLabel(dateStr: string): string {
  const today = easternToday();
  const yesterday = addDays(today, -1);
  if (dateStr === fmt(today)) return "Today";
  if (dateStr === fmt(yesterday)) return "Yesterday";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────

interface DateNavigatorProps {
  date: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  loading?: boolean;
}

export function DateNavigator({ date, onChange, loading }: DateNavigatorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const todayStr = fmt(easternToday());
  const isToday = date === todayStr;
  const isAtMax = date >= todayStr;

  const goBack = () => {
    const d = new Date(date + "T12:00:00");
    onChange(fmt(addDays(d, -1)));
  };

  const goForward = () => {
    if (isAtMax) return;
    const d = new Date(date + "T12:00:00");
    const next = fmt(addDays(d, 1));
    if (next <= todayStr) onChange(next);
  };

  const openPicker = () => {
    inputRef.current?.showPicker();
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val && val <= todayStr) onChange(val);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Back arrow */}
      <button
        onClick={goBack}
        disabled={loading}
        className={cn(
          "p-1.5 rounded-full transition",
          loading
            ? "text-neutral-700 cursor-not-allowed"
            : "text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800",
        )}
        aria-label="Previous day"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Date label (tappable to open picker) */}
      <button
        onClick={openPicker}
        className="text-sm font-medium text-neutral-50 hover:text-blue-400 transition px-2 py-1 rounded-lg hover:bg-neutral-800/50"
      >
        {smartLabel(date)}
      </button>

      {/* Hidden native date picker */}
      <input
        ref={inputRef}
        type="date"
        value={date}
        max={todayStr}
        onChange={handlePickerChange}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        tabIndex={-1}
      />

      {/* Forward arrow */}
      <button
        onClick={goForward}
        disabled={loading || isAtMax}
        className={cn(
          "p-1.5 rounded-full transition",
          loading || isAtMax
            ? "text-neutral-700 cursor-not-allowed"
            : "text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800",
        )}
        aria-label="Next day"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Today quick-jump */}
      {!isToday && (
        <button
          onClick={() => onChange(todayStr)}
          disabled={loading}
          className={cn(
            "ml-1 rounded-full px-2.5 py-1 text-xs font-medium transition",
            loading
              ? "bg-neutral-800 text-neutral-600 cursor-not-allowed"
              : "bg-neutral-800 text-neutral-400 hover:text-neutral-50",
          )}
        >
          Today
        </button>
      )}
    </div>
  );
}
