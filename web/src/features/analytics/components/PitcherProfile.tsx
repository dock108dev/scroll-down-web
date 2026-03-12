"use client";

import type { PitcherProfileInfo } from "../types";

const METRICS: { keys: string[]; label: string }[] = [
  { keys: ["strikeout_rate", "k_rate", "strikeout"], label: "K Rate" },
  { keys: ["walk_rate", "bb_rate", "walk"], label: "BB Rate" },
  { keys: ["contact_suppression"], label: "Contact Supp." },
  { keys: ["power_suppression"], label: "Power Supp." },
];

/** Resolve the first matching key from a profile record. */
function resolve(
  profile: Record<string, number> | null | undefined,
  keys: string[],
): number | undefined {
  if (!profile) return undefined;
  for (const k of keys) {
    if (k in profile) return profile[k];
  }
  return undefined;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

interface PitcherProfileProps {
  label: string;
  info: PitcherProfileInfo;
  bullpen?: Record<string, number> | null;
}

export function PitcherProfile({ label, info, bullpen }: PitcherProfileProps) {
  const hasProfile = info.raw_profile || info.adjusted_profile;
  const profile = info.adjusted_profile ?? info.raw_profile;

  return (
    <div className="card px-3 py-3 space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-neutral-400">{label}</span>
        {info.avg_ip != null && (
          <span className="text-[11px] text-neutral-600 tabular-nums">
            {info.avg_ip.toFixed(1)} avg IP/G
          </span>
        )}
      </div>

      {info.is_regressed && (
        <p className="text-[11px] text-amber-500/80">
          Regressed toward league avg
        </p>
      )}

      {!hasProfile && (
        <p className="text-[11px] text-neutral-600">League-average defaults</p>
      )}

      {hasProfile && profile && (
        <div className="space-y-1">
          {METRICS.map(({ keys, label: metricLabel }) => {
            const raw = resolve(info.raw_profile, keys);
            const adj = resolve(info.adjusted_profile, keys);
            const display = adj ?? raw;

            return (
              <div key={keys[0]} className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 w-24 shrink-0">{metricLabel}</span>
                {info.is_regressed && raw != null && adj != null ? (
                  <span className="text-neutral-400 tabular-nums">
                    <span className="text-neutral-600">{fmtPct(raw)}</span>
                    <span className="text-neutral-600 mx-1">&rarr;</span>
                    {fmtPct(adj)}
                  </span>
                ) : (
                  <span className="text-neutral-400 tabular-nums">
                    {display != null ? fmtPct(display) : "—"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {bullpen && Object.keys(bullpen).length > 0 && (
        <div className="pt-1.5 border-t border-neutral-800/50 space-y-1">
          <span className="text-[11px] text-neutral-600">Bullpen</span>
          {METRICS.map(({ keys, label: metricLabel }) => {
            const val = resolve(bullpen, keys);
            return val != null ? (
              <div key={keys[0]} className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 w-24 shrink-0">{metricLabel}</span>
                <span className="text-neutral-400 tabular-nums">{fmtPct(val)}</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
