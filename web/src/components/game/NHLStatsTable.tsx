import type { NHLSkaterStat, NHLGoalieStat } from "@/lib/types";

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

// ─── Skaters table ──────────────────────────────────────────────

interface NHLSkatersTableProps {
  title: string;
  skaters: NHLSkaterStat[];
}

export function NHLSkatersTable({ title, skaters }: NHLSkatersTableProps) {
  if (skaters.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800/50">
        {title} - Skaters
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
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap">TOI</th>
              <th className="text-right px-2 py-2 font-medium">G</th>
              <th className="text-right px-2 py-2 font-medium">A</th>
              <th className="text-right px-2 py-2 font-medium">PTS</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap">+/-</th>
              <th className="text-right px-2 py-2 font-medium">SOG</th>
              <th className="text-right px-2 py-2 font-medium">HIT</th>
              <th className="text-right px-2 py-2 font-medium">BLK</th>
              <th className="text-right px-2 py-2 font-medium">PIM</th>
            </tr>
          </thead>
          <tbody>
            {skaters.map((s) => {
              const plusMinus = s.plusMinus ?? (s.rawStats?.plusMinus as number | undefined);
              const plusMinusStr =
                plusMinus != null
                  ? plusMinus > 0
                    ? `+${plusMinus}`
                    : String(plusMinus)
                  : "-";

              return (
                <tr
                  key={s.playerName}
                  className="border-b border-neutral-800/50 text-neutral-300"
                >
                  <td
                    className="px-3 py-1.5 bg-neutral-900 sticky left-0 z-10 truncate min-w-[120px] max-w-[140px]"
                    style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }}
                    title={s.playerName}
                  >
                    {abbreviateName(s.playerName)}
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono whitespace-nowrap">
                    {s.toi ?? "-"}
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono">
                    {s.goals ?? "-"}
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono">
                    {s.assists ?? "-"}
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono">
                    {s.points ?? "-"}
                  </td>
                  <td
                    className={`text-right px-2 py-1.5 font-mono ${
                      plusMinus != null && plusMinus > 0
                        ? "text-green-400"
                        : plusMinus != null && plusMinus < 0
                          ? "text-red-500"
                          : ""
                    }`}
                  >
                    {plusMinusStr}
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono">
                    {s.shotsOnGoal ?? "-"}
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono">
                    {s.hits ?? "-"}
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono">
                    {s.blockedShots ?? "-"}
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono">
                    {s.penaltyMinutes ?? "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Goalies table ──────────────────────────────────────────────

interface NHLGoaliesTableProps {
  title: string;
  goalies: NHLGoalieStat[];
}

export function NHLGoaliesTable({ title, goalies }: NHLGoaliesTableProps) {
  if (goalies.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800/50">
        {title} - Goalies
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
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap">TOI</th>
              <th className="text-right px-2 py-2 font-medium">SA</th>
              <th className="text-right px-2 py-2 font-medium">SV</th>
              <th className="text-right px-2 py-2 font-medium">GA</th>
              <th className="text-right px-2 py-2 font-medium whitespace-nowrap">SV%</th>
            </tr>
          </thead>
          <tbody>
            {goalies.map((g) => (
              <tr
                key={g.playerName}
                className="border-b border-neutral-800/50 text-neutral-300"
              >
                <td
                  className="px-3 py-1.5 bg-neutral-900 sticky left-0 z-10 truncate min-w-[120px] max-w-[140px]"
                  style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }}
                  title={g.playerName}
                >
                  {abbreviateName(g.playerName)}
                </td>
                <td className="text-right px-2 py-1.5 font-mono whitespace-nowrap">
                  {g.toi ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 font-mono">
                  {g.shotsAgainst ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 font-mono">
                  {g.saves ?? "-"}
                </td>
                <td className="text-right px-2 py-1.5 font-mono">
                  {g.goalsAgainst ?? "-"}
                </td>
                <td
                  className={`text-right px-2 py-1.5 font-mono font-semibold ${svPctColor(g.savePercentage)}`}
                >
                  {formatSvPct(g.savePercentage)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
