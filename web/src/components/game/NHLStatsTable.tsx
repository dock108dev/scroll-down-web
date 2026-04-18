"use client";

import { useState } from "react";
import type { NHLSkaterStat, NHLGoalieStat } from "@/lib/types";
import { HEADLINE_STATS } from "@/lib/config";

// ─── Name abbreviation ──────────────────────────────────────────

function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;

  const firstName = parts[0];
  const rest = parts.slice(1);

  const suffixPattern = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
  const lastParts: string[] = [];
  const suffixes: string[] = [];

  for (const part of rest) {
    if (suffixPattern.test(part)) {
      suffixes.push(part.endsWith(".") ? part : `${part}.`);
    } else {
      lastParts.push(part);
    }
  }

  const lastName = lastParts.join(" ");
  const suffix = suffixes.length > 0 ? ` ${suffixes.join(" ")}` : "";

  return `${firstName[0]}. ${lastName}${suffix}`;
}

// ─── Save percentage color coding ──────────────────────────────

function svPctColor(svPct: number | undefined): string {
  if (svPct == null) return "text-neutral-300";
  // Normalize: could be 0.923 or 92.3
  const pct = svPct > 1 ? svPct / 100 : svPct;
  if (pct >= 0.92) return "text-green-400";
  if (pct >= 0.9) return "text-neutral-300";
  return "text-red-500";
}

function formatSvPct(svPct: number | undefined): string {
  if (svPct == null) return "-";
  // Normalize to 0-1 range
  const pct = svPct > 1 ? svPct / 100 : svPct;
  // Format as ".923"
  return `.${Math.round(pct * 1000)}`;
}

// ─── TOI parsing ────────────────────────────────────────────────

/** Parse TOI string ("MM:SS") to total seconds for sorting */
function parseTOI(toi: string | undefined): number {
  if (!toi) return -1;
  if (toi.includes(":")) {
    const [m, s] = toi.split(":");
    return Number(m) * 60 + Number(s);
  }
  const num = Number(toi);
  return isNaN(num) ? -1 : num;
}

// ─── Skaters table ──────────────────────────────────────────────

interface NHLSkatersTableProps {
  title: string;
  skaters: NHLSkaterStat[];
}

const SKATER_HEADLINE = HEADLINE_STATS.nhl_skater; // ["G", "A", "PTS"]

export function NHLSkatersTable({ title, skaters: rawSkaters }: NHLSkatersTableProps) {
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());

  const skaters = [...rawSkaters].sort((a, b) => parseTOI(b.toi) - parseTOI(a.toi));
  if (skaters.length === 0) return null;

  const headlineSet = new Set(SKATER_HEADLINE);

  function togglePlayer(name: string) {
    setExpandedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800/50">
        {title} - Skaters
      </div>

      <div>
        {skaters.map((s) => {
          const isExpanded = expandedPlayers.has(s.playerName);
          const plusMinus = s.plusMinus ?? (s.rawStats?.plusMinus as number | undefined);
          const plusMinusStr =
            plusMinus != null
              ? plusMinus > 0
                ? `+${plusMinus}`
                : String(plusMinus)
              : "-";

          // Headline: G, A, PTS
          const headlineItems = [
            { label: "G", value: s.goals != null ? String(s.goals) : "-" },
            { label: "A", value: s.assists != null ? String(s.assists) : "-" },
            { label: "PTS", value: s.points != null ? String(s.points) : "-" },
          ].filter((item) => headlineSet.has(item.label));

          // Rest: TOI, +/-, SOG, HIT, BLK, PIM
          const restItems = [
            { label: "TOI", value: s.toi ?? "-" },
            {
              label: "+/-",
              value: plusMinusStr,
              colorClass:
                plusMinus != null && plusMinus > 0
                  ? "text-green-400"
                  : plusMinus != null && plusMinus < 0
                    ? "text-red-500"
                    : "",
            },
            { label: "SOG", value: s.shotsOnGoal != null ? String(s.shotsOnGoal) : "-" },
            { label: "HIT", value: s.hits != null ? String(s.hits) : "-" },
            { label: "BLK", value: s.blockedShots != null ? String(s.blockedShots) : "-" },
            { label: "PIM", value: s.penaltyMinutes != null ? String(s.penaltyMinutes) : "-" },
          ];

          return (
            <div
              key={s.playerName}
              className="border-b border-neutral-800/50 last:border-b-0"
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800/30 transition-colors"
                onClick={() => togglePlayer(s.playerName)}
                aria-expanded={isExpanded}
                data-testid="player-row"
              >
                <span
                  className="flex-1 truncate text-xs text-neutral-300 min-w-0"
                  title={s.playerName}
                >
                  {abbreviateName(s.playerName)}
                </span>
                <div className="flex gap-3 shrink-0">
                  {headlineItems.map((item) => (
                    <div key={item.label} className="flex flex-col items-center min-w-[24px]">
                      <span className="text-[10px] text-neutral-500 leading-tight">{item.label}</span>
                      <span className="text-xs tabular-nums text-neutral-200 font-medium leading-tight">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
                <span
                  className={`text-[10px] text-neutral-500 shrink-0 transition-transform duration-150 ${isExpanded ? "" : "-rotate-90"}`}
                >
                  &#9660;
                </span>
              </button>

              {isExpanded && (
                <div
                  className="px-3 pb-2 pt-1 grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-1 text-xs bg-neutral-800/20"
                  data-testid="player-row-expanded"
                >
                  {restItems.map((item) => (
                    <div key={item.label} className="flex justify-between gap-1">
                      <span className="text-neutral-500">{item.label}</span>
                      <span className={`tabular-nums ${item.colorClass ?? "text-neutral-300"}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Goalies table ──────────────────────────────────────────────

interface NHLGoaliesTableProps {
  title: string;
  goalies: NHLGoalieStat[];
}

const GOALIE_HEADLINE = HEADLINE_STATS.nhl_goalie; // ["SV", "GA", "SV%"]

export function NHLGoaliesTable({ title, goalies: rawGoalies }: NHLGoaliesTableProps) {
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());

  const goalies = [...rawGoalies].sort((a, b) => parseTOI(b.toi) - parseTOI(a.toi));
  if (goalies.length === 0) return null;

  const headlineSet = new Set(GOALIE_HEADLINE);

  function togglePlayer(name: string) {
    setExpandedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800/50">
        {title} - Goalies
      </div>

      <div>
        {goalies.map((g) => {
          const isExpanded = expandedPlayers.has(g.playerName);
          const svPct = formatSvPct(g.savePercentage);
          const svPctClass = svPctColor(g.savePercentage);

          // All items for this goalie
          const allItems = [
            { label: "TOI",  value: g.toi ?? "-",                                          colorClass: "" },
            { label: "SA",   value: g.shotsAgainst != null ? String(g.shotsAgainst) : "-", colorClass: "" },
            { label: "SV",   value: g.saves != null ? String(g.saves) : "-",               colorClass: "" },
            { label: "GA",   value: g.goalsAgainst != null ? String(g.goalsAgainst) : "-", colorClass: "" },
            { label: "SV%",  value: svPct,                                                  colorClass: `font-semibold ${svPctClass}` },
          ];

          const headlineItems = allItems.filter((i) => headlineSet.has(i.label));
          const restItems = allItems.filter((i) => !headlineSet.has(i.label));

          return (
            <div
              key={g.playerName}
              className="border-b border-neutral-800/50 last:border-b-0"
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800/30 transition-colors"
                onClick={() => togglePlayer(g.playerName)}
                aria-expanded={isExpanded}
                data-testid="player-row"
              >
                <span
                  className="flex-1 truncate text-xs text-neutral-300 min-w-0"
                  title={g.playerName}
                >
                  {abbreviateName(g.playerName)}
                </span>
                <div className="flex gap-3 shrink-0">
                  {headlineItems.map((item) => (
                    <div key={item.label} className="flex flex-col items-center min-w-[28px]">
                      <span className="text-[10px] text-neutral-500 leading-tight">{item.label}</span>
                      <span className={`text-xs tabular-nums font-medium leading-tight ${item.colorClass || "text-neutral-200"}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
                {restItems.length > 0 && (
                  <span
                    className={`text-[10px] text-neutral-500 shrink-0 transition-transform duration-150 ${isExpanded ? "" : "-rotate-90"}`}
                  >
                    &#9660;
                  </span>
                )}
              </button>

              {isExpanded && restItems.length > 0 && (
                <div
                  className="px-3 pb-2 pt-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs bg-neutral-800/20"
                  data-testid="player-row-expanded"
                >
                  {restItems.map((item) => (
                    <div key={item.label} className="flex justify-between gap-1">
                      <span className="text-neutral-500">{item.label}</span>
                      <span className={`tabular-nums ${item.colorClass || "text-neutral-300"}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
