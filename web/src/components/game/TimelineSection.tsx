"use client";

import { useState, useMemo } from "react";
import type { PlayEntry } from "@/lib/types";
import { TimelineRow } from "./TimelineRow";
import { CollapsedPlayGroup } from "./CollapsedPlayGroup";
import { useSettings } from "@/stores/settings";
import { useSectionLayout } from "@/stores/section-layout";
import { cn } from "@/lib/utils";

// ─── Tier filter config ─────────────────────────────────────

const TIER_FILTERS = [
  { tier: 1, label: "Key" },
  { tier: 2, label: "Secondary" },
  { tier: 3, label: "Minor" },
] as const;

// ─── Types ──────────────────────────────────────────────────

interface TimelineSectionProps {
  gameId: number;
  plays: PlayEntry[];
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor?: string;
  awayColor?: string;
}

/** A renderable item inside a period. */
type PeriodItem =
  | { kind: "play"; play: PlayEntry; previousPlay?: PlayEntry }
  | { kind: "tier3-group"; plays: PlayEntry[] };

// ─── Helpers ────────────────────────────────────────────────

/**
 * Content-based dedup: the backend sometimes returns the same play
 * event under different playIndex values (e.g. from overlapping
 * scrape runs). Key on periodLabel + gameClock + description.
 */
function dedupePlays(plays: PlayEntry[]): PlayEntry[] {
  const seen = new Set<string>();
  const result: PlayEntry[] = [];
  for (const play of plays) {
    const key = `${play.periodLabel ?? ""}|${play.gameClock ?? ""}|${play.description ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(play);
    }
  }
  return result;
}

/**
 * Groups plays by periodLabel, deduplicates, and sorts each period
 * chronologically by total score ascending (scores only increase).
 */
function groupByPeriod(plays: PlayEntry[]): Map<string, PlayEntry[]> {
  const unique = dedupePlays(plays);
  const map = new Map<string, PlayEntry[]>();
  for (const play of unique) {
    const key = play.periodLabel ?? "Unknown";
    const arr = map.get(key);
    if (arr) {
      arr.push(play);
    } else {
      map.set(key, [play]);
    }
  }
  // Sort each period chronologically: total score ASC, then playIndex ASC
  for (const periodPlays of map.values()) {
    periodPlays.sort((a, b) => {
      const totalA = (a.homeScore ?? 0) + (a.awayScore ?? 0);
      const totalB = (b.homeScore ?? 0) + (b.awayScore ?? 0);
      if (totalA !== totalB) return totalA - totalB;
      return a.playIndex - b.playIndex;
    });
  }
  return map;
}

/**
 * Returns true for any tier 3 play.
 */
function isTier3(play: PlayEntry): boolean {
  return (play.tier ?? 3) === 3;
}

/**
 * Converts an array of plays within a period into renderable items.
 * Consecutive tier 3 plays are collapsed into a single tier3-group.
 */
function buildPeriodItems(
  periodPlays: PlayEntry[],
  allPlays: PlayEntry[],
): PeriodItem[] {
  const items: PeriodItem[] = [];
  let i = 0;

  while (i < periodPlays.length) {
    const play = periodPlays[i];

    if (isTier3(play)) {
      // Collect consecutive tier 3 plays
      const group: PlayEntry[] = [play];
      let j = i + 1;
      while (j < periodPlays.length && isTier3(periodPlays[j])) {
        group.push(periodPlays[j]);
        j++;
      }
      items.push({ kind: "tier3-group", plays: group });
      i = j;
    } else {
      const prevIdx = play.playIndex - 1;
      const prevPlay = allPlays.find((p) => p.playIndex === prevIdx);
      items.push({ kind: "play", play, previousPlay: prevPlay });
      i++;
    }
  }

  return items;
}

/**
 * Filters period items by visible tiers.
 */
function filterItems(items: PeriodItem[], visibleTiers: number[]): PeriodItem[] {
  return items.filter((item) => {
    if (item.kind === "tier3-group") return visibleTiers.includes(3);
    return visibleTiers.includes(item.play.tier ?? 3);
  });
}

// ─── Period Card ────────────────────────────────────────────

interface PeriodCardProps {
  period: string;
  items: PeriodItem[];
  visibleTiers: number[];
  open: boolean;
  onToggle: () => void;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor?: string;
  awayColor?: string;
}

function PeriodCard({
  period,
  items,
  visibleTiers,
  open,
  onToggle,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
}: PeriodCardProps) {
  const filtered = useMemo(() => filterItems(items, visibleTiers), [items, visibleTiers]);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Sticky period header */}
      <button
        onClick={onToggle}
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
            !open && "-rotate-90",
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
            {filtered.length === 0 ? (
              <p className="text-xs text-neutral-600 px-3 py-2">No plays match filters</p>
            ) : (
              filtered.map((item) =>
                item.kind === "tier3-group" ? (
                  <CollapsedPlayGroup
                    key={`tier3-${item.plays[0].playIndex}`}
                    plays={item.plays}
                    homeTeamAbbr={homeTeamAbbr}
                    awayTeamAbbr={awayTeamAbbr}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                ) : (
                  <TimelineRow
                    key={item.play.playIndex}
                    play={item.play}
                    previousPlay={item.previousPlay}
                    homeTeamAbbr={homeTeamAbbr}
                    awayTeamAbbr={awayTeamAbbr}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                ),
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function TimelineSection({
  gameId,
  plays,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
}: TimelineSectionProps) {
  const defaultTiers = useSettings((s) => s.timelineDefaultTiers);
  const [visibleTiers, setVisibleTiers] = useState<number[]>(defaultTiers);

  // Per-game period expand/collapse persistence
  const { getPeriods, togglePeriod } = useSectionLayout();
  const expandedPeriods = getPeriods(gameId) ?? [];

  const toggleTier = (tier: number) => {
    setVisibleTiers((prev) =>
      prev.includes(tier)
        ? prev.filter((t) => t !== tier)
        : [...prev, tier].sort(),
    );
  };

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
      {/* Tier filter pills */}
      <div className="flex items-center gap-1.5">
        {TIER_FILTERS.map(({ tier, label }) => {
          const active = visibleTiers.includes(tier);
          return (
            <button
              key={tier}
              onClick={() => toggleTier(tier)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                active
                  ? "bg-neutral-700 text-neutral-200"
                  : "bg-transparent text-neutral-600 ring-1 ring-neutral-700/60",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {periods.map(({ period, items }) => (
        <PeriodCard
          key={period}
          period={period}
          items={items}
          visibleTiers={visibleTiers}
          open={expandedPeriods.includes(period)}
          onToggle={() => togglePeriod(gameId, period)}
          homeTeamAbbr={homeTeamAbbr}
          awayTeamAbbr={awayTeamAbbr}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ))}
    </div>
  );
}
