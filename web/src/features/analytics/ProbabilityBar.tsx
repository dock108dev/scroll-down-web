"use client";

interface ProbabilityBarProps {
  teamName: string;
  probability: number;
  color: string;
}

export function ProbabilityBar({
  teamName,
  probability,
  color,
}: ProbabilityBarProps) {
  const pct = Math.round(probability * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-neutral-300 w-28 truncate shrink-0">
        {teamName}
      </span>
      <div className="flex-1 h-5 bg-neutral-800 rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />
      </div>
      <span className="text-sm font-medium text-neutral-200 w-10 text-right tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
