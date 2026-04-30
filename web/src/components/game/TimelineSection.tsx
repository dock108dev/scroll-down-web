"use client";

import { useState, useMemo } from "react";
import type { PlayEntry } from "@/lib/types";
import { TimelineRow } from "./TimelineRow";
import { CollapsedPlayGroup } from "./CollapsedPlayGroup";
import { useSectionLayout } from "@/stores/section-layout";
import { cn } from "@/lib/utils";

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
  | { kind: "play"; play: PlayEntry }
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
  return getTimelineTier(play) === 3;
}

function normalizedPlayText(play: PlayEntry): string {
  return `${play.playType ?? ""} ${play.description ?? ""}`.toLowerCase();
}

function isExtraBaseHit(play: PlayEntry): boolean {
  const text = normalizedPlayText(play);
  if (text.includes("double play") || text.includes("triple play")) return false;
  return (
    text.includes("home run") ||
    text.includes("homer") ||
    /\btriples?\b/.test(text) ||
    /\bdoubles?\b/.test(text)
  );
}

function getTimelineTier(play: PlayEntry): number {
  if (play.scoreChanged || play.scoringTeamAbbr || /\b(home run|homer)\b/.test(normalizedPlayText(play))) {
    return 1;
  }
  if (isExtraBaseHit(play)) {
    return Math.min(play.tier ?? 3, 2);
  }
  return play.tier ?? 3;
}

function withTimelineTier(play: PlayEntry): PlayEntry {
  const tier = getTimelineTier(play);
  return tier === play.tier ? play : { ...play, tier };
}

/**
 * Converts an array of plays within a period into renderable items.
 * Consecutive tier 3 plays are collapsed into a single tier3-group.
 * Used for the full play-by-play view.
 */
function buildPeriodItems(periodPlays: PlayEntry[]): PeriodItem[] {
  const items: PeriodItem[] = [];
  let i = 0;
  while (i < periodPlays.length) {
    const play = periodPlays[i];
    if (isTier3(play)) {
      const group: PlayEntry[] = [play];
      let j = i + 1;
      while (j < periodPlays.length && isTier3(periodPlays[j])) {
        group.push(periodPlays[j]);
        j++;
      }
      items.push({ kind: "tier3-group", plays: group });
      i = j;
    } else {
      items.push({ kind: "play", play: withTimelineTier(play) });
      i++;
    }
  }
  return items;
}

// ─── Period Card ────────────────────────────────────────────

interface PeriodCardProps {
  period: string;
  items: PeriodItem[];
  open: boolean;
  onToggle: () => void;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor?: string;
  awayColor?: string;
  contentId: string;
  expandDetails: boolean;
}

function PeriodCard({
  period,
  items,
  open,
  onToggle,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
  contentId,
  expandDetails,
}: PeriodCardProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Sticky period header */}
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
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
          aria-hidden="true"
        >
          {"\u25BC"}
        </span>
      </button>

      {/* Collapsible content */}
      <div
        id={contentId}
        role="region"
        aria-label={`${period} plays`}
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-2 py-2 space-y-0.5">
            {items.length === 0 ? (
              <p className="text-xs text-neutral-600 px-3 py-2">No plays available</p>
            ) : (
              items.map((item) =>
                item.kind === "tier3-group" ? (
                  <CollapsedPlayGroup
                    key={`tier3-${item.plays[0].playIndex}`}
                    plays={item.plays}
                    expandAll={expandDetails}
                    homeTeamAbbr={homeTeamAbbr}
                    awayTeamAbbr={awayTeamAbbr}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                ) : (
                  <TimelineRow
                    key={item.play.playIndex}
                    play={item.play}
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
  const [expandDetails, setExpandDetails] = useState(false);

  // Per-game period expand/collapse persistence
  const { getPeriods, togglePeriod } = useSectionLayout();
  const expandedPeriods = getPeriods(gameId) ?? [];

  const periods = useMemo(() => {
    const periodMap = groupByPeriod(plays);
    return Array.from(periodMap.entries()).map(([period, periodPlays]) => ({
      period,
      items: buildPeriodItems(periodPlays),
    }));
  }, [plays]);

  const hasCollapsedDetails = periods.some(({ items }) =>
    items.some((item) => item.kind === "tier3-group"),
  );

  if (plays.length === 0) {
    return (
      <div data-testid="timeline-empty" className="px-4 py-4 text-sm text-neutral-500">
        Play-by-play isn&apos;t available for this game yet.
      </div>
    );
  }

  return (
    <div data-testid="timeline-section" className="px-4 space-y-2">
      {/* Detail expansion */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">
          Full play-by-play
        </span>
        {hasCollapsedDetails && (
          <button
            onClick={() => setExpandDetails(s => !s)}
            aria-pressed={expandDetails}
            aria-label={expandDetails ? "Collapse play details" : "Expand play details"}
            data-testid="timeline-expand-details"
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              expandDetails
                ? "bg-neutral-700 text-neutral-200"
                : "bg-transparent text-neutral-400 ring-1 ring-neutral-700/60 hover:ring-neutral-500",
            )}
          >
            {expandDetails ? "Collapse details" : "Expand details"}
          </button>
        )}
      </div>

      {periods.map(({ period, items }) => (
        <PeriodCard
          key={period}
          period={period}
          items={items}
          open={expandedPeriods.includes(period)}
          onToggle={() => togglePeriod(gameId, period)}
          homeTeamAbbr={homeTeamAbbr}
          awayTeamAbbr={awayTeamAbbr}
          homeColor={homeColor}
          awayColor={awayColor}
          contentId={`timeline-period-${gameId}-${period.replace(/\s+/g, "-")}`}
          expandDetails={expandDetails}
        />
      ))}
    </div>
  );
}
