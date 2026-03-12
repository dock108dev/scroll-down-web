"use client";

const EVENT_LABELS: { key: string; label: string }[] = [
  { key: "home_run", label: "HR" },
  { key: "triple", label: "3B" },
  { key: "double", label: "2B" },
  { key: "single", label: "1B" },
  { key: "walk", label: "BB" },
  { key: "strikeout", label: "K" },
];

interface PABreakdownProps {
  label: string;
  probs: Record<string, number>;
}

export function PABreakdown({ label, probs }: PABreakdownProps) {
  return (
    <div className="card px-3 py-3 space-y-2">
      <span className="text-xs font-medium text-neutral-400">{label}</span>
      <div className="space-y-1.5">
        {EVENT_LABELS.map(({ key, label: eventLabel }) => {
          const val = probs[`${key}_probability`] ?? probs[key] ?? 0;
          const pct = (val * 100).toFixed(1);
          return (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 w-6">{eventLabel}</span>
              <div className="flex-1 mx-2 h-1.5 bg-neutral-800 rounded overflow-hidden">
                <div
                  className="h-full bg-neutral-500 rounded"
                  style={{ width: `${Math.min(val * 100 * 3, 100)}%` }}
                />
              </div>
              <span className="text-neutral-400 tabular-nums w-10 text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
