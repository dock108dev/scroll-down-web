"use client";

import { useState } from "react";
import type { PlayEntry } from "@/lib/types";
import { TimelineRow } from "./TimelineRow";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────

interface TimelineSectionProps {
  plays: PlayEntry[];
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor?: string;
  awayColor?: string;
}

/** A renderable item inside a period. */
type PeriodItem = { kind: "play"; play: PlayEntry; previousPlay?: PlayEntry };

// ─── Helpers ────────────────────────────────────────────────

/**
 * Groups plays by periodLabel. Maintains insertion order.
 */
function groupByPeriod(plays: PlayEntry[]): Map<string, PlayEntry[]> {
  const map = new Map<string, PlayEntry[]>();
  for (const play of plays) {
    const key = play.periodLabel ?? "Unknown";
    const arr = map.get(key);
    if (arr) {
      arr.push(play);
    } else {
      map.set(key, [play]);
    }
  }
  return map;
}

/**
 * Converts an array of plays within a period into renderable items.
 * All plays (including tier 3) are rendered individually for full clarity.
 */
function buildPeriodItems(
  periodPlays: PlayEntry[],
  allPlays: PlayEntry[],
): PeriodItem[] {
  return periodPlays.map((play) => {
    const prevIdx = play.playIndex - 1;
    const prevPlay = allPlays.find((p) => p.playIndex === prevIdx);
    return { kind: "play" as const, play, previousPlay: prevPlay };
  });
}

// ─── Period Card ────────────────────────────────────────────

interface PeriodCardProps {
  period: string;
  items: PeriodItem[];
  defaultOpen: boolean;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor?: string;
  awayColor?: string;
}

function PeriodCard({
  period,
  items,
  defaultOpen,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
}: PeriodCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Sticky period header */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between px-4 py-3",
          "text-sm font-semibold text-neutral-200",
          "hover:bg-neutral-800/50 transition",
          "sticky top-0 z-10 bg-neutral-900 border-b border-neutral-800/50",
        )}
      >
        <span>{period}</span>
        <span
          className={cn(
            "text-xs text-neutral-500 transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          {"\u25BC"}
        </span>
      </button>

      {/* Collapsible content */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-2 py-2 space-y-0.5">
            {items.map((item) => (
              <TimelineRow
                key={item.play.playIndex}
                play={item.play}
                previousPlay={item.previousPlay}
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

// ─── Main Component ─────────────────────────────────────────

export function TimelineSection({
  plays,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
}: TimelineSectionProps) {
  if (plays.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-neutral-500">
        No play-by-play data available
      </div>
    );
  }

  const periodMap = groupByPeriod(plays);

  // Build renderable items for each period
  const periods = Array.from(periodMap.entries()).map(
    ([period, periodPlays]) => ({
      period,
      items: buildPeriodItems(periodPlays, plays),
    }),
  );

  return (
    <div className="px-4 space-y-2">
      {periods.map(({ period, items }) => (
        <PeriodCard
          key={period}
          period={period}
          items={items}
          defaultOpen={false}
          homeTeamAbbr={homeTeamAbbr}
          awayTeamAbbr={awayTeamAbbr}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ))}
    </div>
  );
}
