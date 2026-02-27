"use client";

import { cn } from "@/lib/utils";

/** League-specific colour map matching the iOS app. */
const LEAGUE_COLORS: Record<string, { bg: string; text: string }> = {
  nba: { bg: "rgba(196, 92, 38, 0.20)", text: "rgb(196, 92, 38)" },
  nhl: { bg: "rgba(0, 69, 140, 0.25)", text: "rgb(70, 150, 230)" },
  ncaab: { bg: "rgba(33, 140, 33, 0.20)", text: "rgb(33, 140, 33)" },
  nfl: { bg: "rgba(0, 53, 148, 0.25)", text: "rgb(70, 130, 230)" },
  ncaaf: { bg: "rgba(130, 0, 20, 0.20)", text: "rgb(200, 60, 60)" },
  mlb: { bg: "rgba(0, 45, 114, 0.25)", text: "rgb(70, 130, 230)" },
};

const DEFAULT_COLORS = { bg: "rgba(140, 145, 158, 0.15)", text: "rgb(140, 145, 158)" };

interface LeagueBadgeProps {
  league: string;
  className?: string;
}

export function LeagueBadge({ league, className }: LeagueBadgeProps) {
  const colors = LEAGUE_COLORS[league.toLowerCase()] ?? DEFAULT_COLORS;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none",
        className,
      )}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {league.toUpperCase()}
    </span>
  );
}
