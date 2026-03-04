"use client";

// ── Date helpers (US/Eastern) ──────────────────────────────

function easternToday(): Date {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  now.setHours(0, 0, 0, 0);
  return now;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Component ──────────────────────────────────────────────

interface DateNavigatorProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (startDate: string, endDate: string) => void;
}

export function DateNavigator({ startDate, endDate, onChange }: DateNavigatorProps) {
  const todayStr = fmt(easternToday());

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={startDate}
        max={endDate}
        onChange={(e) => {
          const val = e.target.value;
          if (val && val <= endDate) onChange(val, endDate);
        }}
        className="rounded-lg bg-neutral-800 border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-50 focus:outline-none focus:border-neutral-500 transition [color-scheme:dark]"
      />

      <span className="text-xs text-neutral-500">to</span>

      <input
        type="date"
        value={endDate}
        min={startDate}
        max={todayStr}
        onChange={(e) => {
          const val = e.target.value;
          if (val && val >= startDate && val <= todayStr) onChange(startDate, val);
        }}
        className="rounded-lg bg-neutral-800 border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-50 focus:outline-none focus:border-neutral-500 transition [color-scheme:dark]"
      />
    </div>
  );
}
