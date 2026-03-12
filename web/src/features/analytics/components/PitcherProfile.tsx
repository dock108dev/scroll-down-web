"use client";

import type { PitcherProfileInfo } from "../types";

const METRICS: { key: string; label: string }[] = [
  { key: "strikeout", label: "K Rate" },
  { key: "walk", label: "BB Rate" },
  { key: "contact_suppression", label: "Contact Supp." },
  { key: "power_suppression", label: "Power Supp." },
];

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
          {METRICS.map(({ key, label: metricLabel }) => {
            const raw = info.raw_profile?.[key];
            const adj = info.adjusted_profile?.[key];
            const display = adj ?? raw;

            return (
              <div key={key} className="flex items-center justify-between text-xs">
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
          {METRICS.map(({ key, label: metricLabel }) => {
            const val = bullpen[key];
            return val != null ? (
              <div key={key} className="flex items-center justify-between text-xs">
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
