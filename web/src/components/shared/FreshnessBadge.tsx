"use client";

import type { DataStalenessState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FreshnessBadgeProps {
  staleness: DataStalenessState;
  ageLabel: string | null;
  isFinal?: boolean;
  className?: string;
}

const DOT_COLORS: Record<DataStalenessState, string> = {
  fresh: "bg-green-400",
  stale: "bg-yellow-400",
  very_stale: "bg-red-400",
};

export function FreshnessBadge({ staleness, ageLabel, isFinal, className }: FreshnessBadgeProps) {
  if (isFinal) return null;

  return (
    <span
      data-testid="freshness-badge"
      data-staleness={staleness}
      className={cn("inline-flex items-center gap-1", className)}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", DOT_COLORS[staleness])} />
      {staleness === "stale" && ageLabel && (
        <span className="text-[10px] text-yellow-500 whitespace-nowrap">Updated {ageLabel}</span>
      )}
      {staleness === "very_stale" && (
        <span className="text-[10px] text-red-400 whitespace-nowrap">Data may be delayed</span>
      )}
    </span>
  );
}
