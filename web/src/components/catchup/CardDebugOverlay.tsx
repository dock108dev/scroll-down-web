"use client";

import type { BaseballBaseState } from "@/lib/types";

export interface CardDebugOverlayProps {
  cardIndex: number;
  cardType: string;
  scoreBefore: { home: number; away: number };
  scoreAfter: { home: number; away: number };
  outsBefore: number;
  outsAfter: number;
  basesBefore: BaseballBaseState;
  basesAfter: BaseballBaseState;
  countBefore: { balls: number; strikes: number } | null;
  phase: string;
}

function basesStr(b: BaseballBaseState): string {
  return [b.first ? "1" : "_", b.second ? "2" : "_", b.third ? "3" : "_"].join("");
}

/**
 * Dev-only validation overlay rendered on top of a play card when
 * `?debug=true` is set. Surfaces the per-card state needed by the BRAINDUMP
 * validation loop (scoreboard / runners / result text / breath-card carry-
 * forward / next-card start-state) so it can be checked against the rendered
 * card without opening DevTools.
 */
export function CardDebugOverlay({
  cardIndex,
  cardType,
  scoreBefore,
  scoreAfter,
  outsBefore,
  outsAfter,
  basesBefore,
  basesAfter,
  countBefore,
  phase,
}: CardDebugOverlayProps) {
  const rows: [string, string][] = [
    ["idx/type", `#${cardIndex} · ${cardType}`],
    ["phase", phase],
    [
      "score",
      `${scoreBefore.away}-${scoreBefore.home} → ${scoreAfter.away}-${scoreAfter.home}`,
    ],
    ["outs", `${outsBefore} → ${outsAfter}`],
    ["bases", `${basesStr(basesBefore)} → ${basesStr(basesAfter)}`],
    [
      "count",
      countBefore ? `${countBefore.balls}-${countBefore.strikes} → 0-0` : "n/a",
    ],
  ];

  return (
    <div
      data-testid="card-debug-overlay"
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,0.82)",
        color: "#a3e635",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        lineHeight: 1.5,
        padding: "6px 10px",
        borderRadius: 4,
        pointerEvents: "none",
        userSelect: "none",
        maxWidth: 260,
      }}
      aria-hidden
    >
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "flex", gap: 8 }}>
          <span style={{ color: "#6b7280", minWidth: 52 }}>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

export interface RhythmDebugBadgeProps {
  cardIndex: number;
  kind: string;
  score: { home: number; away: number };
}

/**
 * Smaller debug badge for rhythm/breath cards. After the score-carry-forward
 * fix, the score shown here must match the `scoreAfter` of the preceding play
 * card — that is the primary visual check the validation loop hangs on.
 */
export function RhythmDebugBadge({
  cardIndex,
  kind,
  score,
}: RhythmDebugBadgeProps) {
  return (
    <div
      data-testid="rhythm-debug-badge"
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,0.82)",
        color: "#a3e635",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        lineHeight: 1.5,
        padding: "6px 10px",
        borderRadius: 4,
        pointerEvents: "none",
        userSelect: "none",
      }}
      aria-hidden
    >
      <div>{`#${cardIndex} · ${kind}`}</div>
      <div>{`score ${score.away}–${score.home}`}</div>
    </div>
  );
}
