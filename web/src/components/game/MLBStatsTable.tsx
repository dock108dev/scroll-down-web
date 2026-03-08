import type { MLBBatterStat, MLBPitcherStat } from "@/lib/types";

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

export function MLBBattersTable({ title, batters: rawBatters }: MLBBattersTableProps) {
  const batters = [...rawBatters].sort((a, b) => getPlateAppearances(b) - getPlateAppearances(a));
  if (batters.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800/50">
        {title} - Batters
      </div>

      <div className="relative overflow-x-auto hide-scrollbar">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              <th
                className="text-left px-3 py-2 font-medium bg-neutral-900 sticky left-0 z-10 min-w-[120px] max-w-[140px]"
                style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }}
              >
                Player
              </th>
              <th className="text-right px-2 py-2 font-medium">PA</th>
              <th className="text-right px-2 py-2 font-medium">AB</th>
              <th className="text-right px-2 py-2 font-medium">H</th>
              <th className="text-right px-2 py-2 font-medium">R</th>
              <th className="text-right px-2 py-2 font-medium">RBI</th>
              <th className="text-right px-2 py-2 font-medium">HR</th>
              <th className="text-right px-2 py-2 font-medium">BB</th>
              <th className="text-right px-2 py-2 font-medium">K</th>
              <th className="text-right px-2 py-2 font-medium">SB</th>
              <th className="text-right px-2 py-2 font-medium">AVG</th>
              <th className="text-right px-2 py-2 font-medium">OBP</th>
              <th className="text-right px-2 py-2 font-medium">SLG</th>
              <th className="text-right px-2 py-2 font-medium">OPS</th>
            </tr>
          </thead>
          <tbody>
            {batters.map((b) => (
              <tr
                key={b.playerName}
                className="border-b border-neutral-800/50 text-neutral-300"
              >
                <td
                  className="px-3 py-1.5 bg-neutral-900 sticky left-0 z-10 truncate min-w-[120px] max-w-[140px]"
                  style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }}
                  title={b.playerName}
                >
                  {abbreviateName(b.playerName)}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {getPlateAppearances(b) || "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.atBats ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.hits ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.runs ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.rbi ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.homeRuns ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.baseOnBalls ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.strikeOuts ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.stolenBases ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.avg ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.obp ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {b.slg ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums font-semibold">
                  {b.ops ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pitchers table ──────────────────────────────────────────────

interface MLBPitchersTableProps {
  title: string;
  pitchers: MLBPitcherStat[];
}

export function MLBPitchersTable({ title, pitchers: rawPitchers }: MLBPitchersTableProps) {
  const pitchers = [...rawPitchers].sort(
    (a, b) => parseInningsPitched(b.inningsPitched) - parseInningsPitched(a.inningsPitched),
  );
  if (pitchers.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800/50">
        {title} - Pitchers
      </div>

      <div className="relative overflow-x-auto hide-scrollbar">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              <th
                className="text-left px-3 py-2 font-medium bg-neutral-900 sticky left-0 z-10 min-w-[120px] max-w-[140px]"
                style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }}
              >
                Player
              </th>
              <th className="text-right px-2 py-2 font-medium">IP</th>
              <th className="text-right px-2 py-2 font-medium">H</th>
              <th className="text-right px-2 py-2 font-medium">R</th>
              <th className="text-right px-2 py-2 font-medium">ER</th>
              <th className="text-right px-2 py-2 font-medium">BB</th>
              <th className="text-right px-2 py-2 font-medium">K</th>
              <th className="text-right px-2 py-2 font-medium">HR</th>
              <th className="text-right px-2 py-2 font-medium">ERA</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap">PC-ST</th>
            </tr>
          </thead>
          <tbody>
            {pitchers.map((p) => (
              <tr
                key={p.playerName}
                className="border-b border-neutral-800/50 text-neutral-300"
              >
                <td
                  className="px-3 py-1.5 bg-neutral-900 sticky left-0 z-10 truncate min-w-[120px] max-w-[140px]"
                  style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }}
                  title={p.playerName}
                >
                  {abbreviateName(p.playerName)}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {p.inningsPitched ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {p.hits ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {p.runs ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {p.earnedRuns ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {p.baseOnBalls ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {p.strikeOuts ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums">
                  {p.homeRuns ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums font-semibold">
                  {p.era ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums whitespace-nowrap">
                  {p.pitchCount != null && p.strikes != null
                    ? `${p.pitchCount}-${p.strikes}`
                    : p.pitchCount ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
