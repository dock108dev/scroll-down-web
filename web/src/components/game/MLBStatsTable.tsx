"use client";

import { useState } from "react";
import type { MLBBatterStat, MLBPitcherStat } from "@/lib/types";
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

// ─── Sorting helpers ────────────────────────────────────────────

/** Compute plate appearances for sorting: PA = AB + BB + HBP + SF + SH (fallback to AB + BB) */
function getPlateAppearances(b: MLBBatterStat): number {
  const raw = b.rawStats ?? {};
  // Check for explicit PA in rawStats
  const pa = raw.plateAppearances ?? raw.pa ?? raw.PA;
  if (pa != null && typeof pa === "number") return pa;
  // Compute from available fields
  const ab = b.atBats ?? 0;
  const bb = b.baseOnBalls ?? 0;
  const hbp = (typeof raw.hitByPitch === "number" ? raw.hitByPitch : 0) +
    (typeof raw.hbp === "number" ? raw.hbp : 0 );
  const sf = typeof raw.sacFlies === "number" ? raw.sacFlies :
    typeof raw.sf === "number" ? raw.sf : 0;
  const sh = typeof raw.sacBunts === "number" ? raw.sacBunts :
    typeof raw.sh === "number" ? raw.sh : 0;
  return ab + bb + hbp + sf + sh;
}

/** Parse IP string (e.g. "5.2" means 5 and 2/3 innings) to numeric value for sorting */
function parseInningsPitched(ip: string | null | undefined): number {
  if (!ip) return -1;
  const num = Number(ip);
  if (isNaN(num)) return -1;
  // In baseball, "5.2" means 5 and 2/3 innings
  const whole = Math.floor(num);
  const frac = Math.round((num - whole) * 10);
  return whole + frac / 3;
}

// ─── Batters table ──────────────────────────────────────────────

interface MLBBattersTableProps {
  title: string;
  batters: MLBBatterStat[];
}

const BATTER_HEADLINE = HEADLINE_STATS.mlb_batter; // ["H", "RBI", "AVG"]

export function MLBBattersTable({ title, batters: rawBatters }: MLBBattersTableProps) {
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());

  const batters = [...rawBatters].sort((a, b) => getPlateAppearances(b) - getPlateAppearances(a));
  if (batters.length === 0) return null;

  const headlineSet = new Set(BATTER_HEADLINE);

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
        {title} - Batters
      </div>

      <div>
        {batters.map((b) => {
          const isExpanded = expandedPlayers.has(b.playerName);
          const pa = getPlateAppearances(b);

          const allItems = [
            { label: "PA",  value: pa || "-" },
            { label: "AB",  value: b.atBats ?? "-" },
            { label: "H",   value: b.hits ?? "-" },
            { label: "R",   value: b.runs ?? "-" },
            { label: "RBI", value: b.rbi ?? "-" },
            { label: "HR",  value: b.homeRuns ?? "-" },
            { label: "BB",  value: b.baseOnBalls ?? "-" },
            { label: "K",   value: b.strikeOuts ?? "-" },
            { label: "SB",  value: b.stolenBases ?? "-" },
            { label: "AVG", value: b.avg ?? "-" },
            { label: "OBP", value: b.obp ?? "-" },
            { label: "SLG", value: b.slg ?? "-" },
            { label: "OPS", value: b.ops ?? "-", bold: true },
          ] as const;

          type ItemLabel = typeof allItems[number]["label"];
          const headlineItems = allItems.filter((i) => headlineSet.has(i.label as ItemLabel));
          const restItems = allItems.filter((i) => !headlineSet.has(i.label as ItemLabel));

          return (
            <div
              key={b.playerName}
              className="border-b border-neutral-800/50 last:border-b-0"
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800/30 transition-colors"
                onClick={() => togglePlayer(b.playerName)}
                aria-expanded={isExpanded}
                data-testid="player-row"
              >
                <span
                  className="flex-1 truncate text-xs text-neutral-300 min-w-0"
                  title={b.playerName}
                >
                  {abbreviateName(b.playerName)}
                </span>
                <div className="flex gap-3 shrink-0">
                  {headlineItems.map((item) => (
                    <div key={item.label} className="flex flex-col items-center min-w-[28px]">
                      <span className="text-[10px] text-neutral-500 leading-tight">{item.label}</span>
                      <span className="text-xs tabular-nums text-neutral-200 font-medium leading-tight">
                        {String(item.value)}
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
                  className="px-3 pb-2 pt-1 grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-1 text-xs bg-neutral-800/20"
                  data-testid="player-row-expanded"
                >
                  {restItems.map((item) => (
                    <div key={item.label} className="flex justify-between gap-1">
                      <span className="text-neutral-500">{item.label}</span>
                      <span className={`tabular-nums ${"bold" in item && item.bold ? "font-semibold" : ""} text-neutral-300`}>
                        {String(item.value)}
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

// ─── Pitchers table ──────────────────────────────────────────────

interface MLBPitchersTableProps {
  title: string;
  pitchers: MLBPitcherStat[];
}

const PITCHER_HEADLINE = HEADLINE_STATS.mlb_pitcher; // ["IP", "K", "ERA"]

export function MLBPitchersTable({ title, pitchers: rawPitchers }: MLBPitchersTableProps) {
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());

  const pitchers = [...rawPitchers].sort(
    (a, b) => parseInningsPitched(b.inningsPitched) - parseInningsPitched(a.inningsPitched),
  );
  if (pitchers.length === 0) return null;

  const headlineSet = new Set(PITCHER_HEADLINE);

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
        {title} - Pitchers
      </div>

      <div>
        {pitchers.map((p) => {
          const isExpanded = expandedPlayers.has(p.playerName);
          const pcSt =
            p.pitchCount != null && p.strikes != null
              ? `${p.pitchCount}-${p.strikes}`
              : p.pitchCount != null
                ? String(p.pitchCount)
                : "-";

          const allItems = [
            { label: "IP",    value: p.inningsPitched ?? "-" },
            { label: "H",     value: p.hits ?? "-" },
            { label: "R",     value: p.runs ?? "-" },
            { label: "ER",    value: p.earnedRuns ?? "-" },
            { label: "BB",    value: p.baseOnBalls ?? "-" },
            { label: "K",     value: p.strikeOuts ?? "-" },
            { label: "HR",    value: p.homeRuns ?? "-" },
            { label: "ERA",   value: p.era ?? "-", bold: true },
            { label: "PC-ST", value: pcSt },
          ] as const;

          type ItemLabel = typeof allItems[number]["label"];
          const headlineItems = allItems.filter((i) => headlineSet.has(i.label as ItemLabel));
          const restItems = allItems.filter((i) => !headlineSet.has(i.label as ItemLabel));

          return (
            <div
              key={p.playerName}
              className="border-b border-neutral-800/50 last:border-b-0"
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800/30 transition-colors"
                onClick={() => togglePlayer(p.playerName)}
                aria-expanded={isExpanded}
                data-testid="player-row"
              >
                <span
                  className="flex-1 truncate text-xs text-neutral-300 min-w-0"
                  title={p.playerName}
                >
                  {abbreviateName(p.playerName)}
                </span>
                <div className="flex gap-3 shrink-0">
                  {headlineItems.map((item) => (
                    <div key={item.label} className="flex flex-col items-center min-w-[28px]">
                      <span className="text-[10px] text-neutral-500 leading-tight">{item.label}</span>
                      <span className={`text-xs tabular-nums font-medium leading-tight ${"bold" in item && item.bold ? "text-neutral-100" : "text-neutral-200"}`}>
                        {String(item.value)}
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
                  className="px-3 pb-2 pt-1 grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-1 text-xs bg-neutral-800/20"
                  data-testid="player-row-expanded"
                >
                  {restItems.map((item) => (
                    <div key={item.label} className="flex justify-between gap-1">
                      <span className="text-neutral-500">{item.label}</span>
                      <span className={`tabular-nums ${"bold" in item && item.bold ? "font-semibold" : ""} text-neutral-300`}>
                        {String(item.value)}
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
