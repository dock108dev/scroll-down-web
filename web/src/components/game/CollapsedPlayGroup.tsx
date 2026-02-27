"use client";

import { useState } from "react";
import type { PlayEntry } from "@/lib/types";
import { TimelineRow } from "./TimelineRow";
import { cn } from "@/lib/utils";

interface CollapsedPlayGroupProps {
  plays: PlayEntry[];
  summaryLabel?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor?: string;
  awayColor?: string;
}

/**
 * Generates a client-side summary label by counting play types.
 * E.g. "2 missed shots, 1 rebound, 1 other"
 */
function generateSummary(plays: PlayEntry[]): string {
  const counts: Record<string, number> = {};

  for (const play of plays) {
    const desc = (play.description ?? "").toLowerCase();
    const type = play.playType?.toLowerCase() ?? "";

    if (desc.includes("miss") || type.includes("miss")) {
      counts["missed shot"] = (counts["missed shot"] ?? 0) + 1;
    } else if (desc.includes("rebound") || type.includes("rebound")) {
      counts["rebound"] = (counts["rebound"] ?? 0) + 1;
    } else if (desc.includes("turnover") || type.includes("turnover")) {
      counts["turnover"] = (counts["turnover"] ?? 0) + 1;
    } else if (desc.includes("foul") || type.includes("foul")) {
      counts["foul"] = (counts["foul"] ?? 0) + 1;
    } else if (desc.includes("substitution") || type.includes("substitution")) {
      counts["substitution"] = (counts["substitution"] ?? 0) + 1;
    } else if (desc.includes("timeout") || type.includes("timeout")) {
      counts["timeout"] = (counts["timeout"] ?? 0) + 1;
    } else if (desc.includes("violation") || type.includes("violation")) {
      counts["violation"] = (counts["violation"] ?? 0) + 1;
    } else {
      counts["other"] = (counts["other"] ?? 0) + 1;
    }
  }

  const parts: string[] = [];
  for (const [label, count] of Object.entries(counts)) {
    const plural = count > 1 && !label.endsWith("s") ? `${label}s` : label;
    parts.push(`${count} ${plural}`);
  }

  return parts.join(", ") || `${plays.length} plays`;
}

export function CollapsedPlayGroup({
  plays,
  summaryLabel,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
}: CollapsedPlayGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const label = summaryLabel || generateSummary(plays);

  return (
    <div className="ml-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 w-full py-1.5 px-2 rounded text-left",
          "hover:bg-neutral-800/30 transition-colors group",
        )}
      >
        {/* Chevron indicator */}
        <span
          className={cn(
            "text-[10px] text-neutral-600 transition-transform duration-150",
            expanded && "rotate-90",
          )}
        >
          {"\u25B6"}
        </span>

        {/* Dot cluster indicator */}
        <span className="flex items-center gap-0.5 shrink-0">
          <span className="w-1 h-1 rounded-full bg-neutral-600" />
          <span className="w-1 h-1 rounded-full bg-neutral-600" />
          <span className="w-1 h-1 rounded-full bg-neutral-600" />
        </span>

        {/* Summary text */}
        <span className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors">
          {label}
        </span>

        {/* Play count badge */}
        <span className="ml-auto text-[10px] text-neutral-600 tabular-nums">
          {plays.length}
        </span>
      </button>

      {/* Expanded individual plays */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 pt-1 pb-1">
            {plays.map((play) => (
              <TimelineRow
                key={play.playIndex}
                play={play}
                homeTeamAbbr={homeTeamAbbr}
                awayTeamAbbr={awayTeamAbbr}
                homeColor={homeColor}
                awayColor={awayColor}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
