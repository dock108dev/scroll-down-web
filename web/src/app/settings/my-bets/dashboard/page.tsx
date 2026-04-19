"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMyBets } from "@/stores/my-bets";
import { useTier } from "@/stores/tier";
import type { LoggedBet } from "@/lib/types";

const MIN_BETS_FOR_DASHBOARD = 3;
const SPARKLINE_MAX_BETS = 50;

// ─── Derived stats ───────────────────────────────────────────────────────────


function normalizeMkt(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("spread")) return "Spread";
  if (k.includes("total") || k.includes("ou") || k.includes("over")) return "Total";
  if (k.includes("moneyline") || k.includes("ml") || k.includes("h2h")) return "Moneyline";
  return "Prop";
}

function groupByAvgClv<T extends string>(
  bets: LoggedBet[],
  keyFn: (b: LoggedBet) => T,
): Array<{ key: T; count: number; avgClv: number }> {
  const map = new Map<T, { sum: number; count: number }>();
  for (const b of bets) {
    if (b.clvPercent == null) continue;
    const k = keyFn(b);
    const cur = map.get(k) ?? { sum: 0, count: 0 };
    map.set(k, { sum: cur.sum + b.clvPercent, count: cur.count + 1 });
  }
  return Array.from(map.entries())
    .map(([key, { sum, count }]) => ({ key, count, avgClv: sum / count }))
    .sort((a, b) => b.avgClv - a.avgClv);
}

function useDashboardData(bets: LoggedBet[]) {
  return useMemo(() => {
    const total = bets.length;
    const wins = bets.filter((b) => b.outcome === "win").length;
    const losses = bets.filter((b) => b.outcome === "loss").length;
    const pushes = bets.filter((b) => b.outcome === "push").length;

    const clvBets = bets.filter((b) => b.clvPercent != null);
    const avgClv =
      clvBets.length > 0
        ? clvBets.reduce((s, b) => s + b.clvPercent!, 0) / clvBets.length
        : null;

    // Chronological for sparkline (store is newest-first)
    const chronoBets = [...bets].reverse().slice(-SPARKLINE_MAX_BETS);
    const sparklinePoints = chronoBets
      .map((b, i) => ({ i, clv: b.clvPercent }))
      .filter((p): p is { i: number; clv: number } => p.clv != null);

    const byBook: BreakdownRow[] = groupByAvgClv(bets, (b) => b.book).map((r) => ({
      label: r.key,
      count: r.count,
      avgClv: r.avgClv,
    }));

    const byMarket: BreakdownRow[] = groupByAvgClv(bets, (b) =>
      normalizeMkt(b.marketKey),
    ).map((r) => ({ label: r.key, count: r.count, avgClv: r.avgClv }));

    return { total, wins, losses, pushes, avgClv, sparklinePoints, byBook, byMarket };
  }, [bets]);
}

// ─── CLV label helpers ────────────────────────────────────────────────────────

function clvLabel(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function clvStyle(pct: number): React.CSSProperties {
  if (pct > 0) return { color: "var(--ev-good-text, #4ade80)" };
  if (pct < 0) return { color: "var(--ev-negative-text, #f87171)" };
  return { color: "var(--ds-text-tertiary)" };
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

const SVG_W = 400;
const SVG_H = 60;
const PAD = 4;

function Sparkline({ points }: { points: Array<{ i: number; clv: number }> }) {
  if (points.length < 2) {
    return (
      <p className="text-xs text-neutral-600 italic">
        Need at least 2 bets with closing line data to render trend.
      </p>
    );
  }

  const clvs = points.map((p) => p.clv);
  const minClv = Math.min(...clvs);
  const maxClv = Math.max(...clvs);
  const range = maxClv - minClv || 1;
  const n = points.length;

  const toX = (i: number) => PAD + ((i / (n - 1)) * (SVG_W - PAD * 2));
  const toY = (clv: number) =>
    PAD + ((maxClv - clv) / range) * (SVG_H - PAD * 2);

  const polyPoints = points.map((p) => `${toX(p.i)},${toY(p.clv)}`).join(" ");
  const zeroY = toY(0);
  const zeroInRange = zeroY >= PAD && zeroY <= SVG_H - PAD;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full"
      style={{ height: SVG_H }}
      data-testid="clv-sparkline"
      aria-label="CLV% trend"
    >
      {/* Zero line */}
      {zeroInRange && (
        <line
          x1={PAD}
          y1={zeroY}
          x2={SVG_W - PAD}
          y2={zeroY}
          stroke="var(--fb-border-subtle, #2a2a2a)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {/* Sparkline */}
      <polyline
        points={polyPoints}
        fill="none"
        stroke="var(--fb-info, #60a5fa)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {points.map((p, idx) => (
        <circle
          key={idx}
          cx={toX(p.i)}
          cy={toY(p.clv)}
          r={2}
          fill={p.clv >= 0 ? "var(--ev-good-text, #4ade80)" : "var(--ev-negative-text, #f87171)"}
        />
      ))}
    </svg>
  );
}

// ─── Breakdown table ──────────────────────────────────────────────────────────

interface BreakdownRow {
  label: string;
  count: number;
  avgClv: number;
}

function BreakdownTable({
  rows,
  labelHeader,
}: {
  rows: BreakdownRow[];
  labelHeader: string;
}) {
  return (
    <table className="w-full text-left border-collapse text-xs">
      <thead>
        <tr
          className="border-b text-[10px] uppercase text-neutral-600"
          style={{ borderColor: "var(--fb-border-subtle)" }}
        >
          <th className="pb-2 pr-4 font-medium">{labelHeader}</th>
          <th className="pb-2 pr-4 font-medium">Bets</th>
          <th className="pb-2 font-medium">Avg CLV%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            className="border-b"
            style={{ borderColor: "var(--fb-border-subtle)" }}
          >
            <td className="py-2 pr-4 text-neutral-200 font-medium">{row.label}</td>
            <td className="py-2 pr-4 text-neutral-400">{row.count}</td>
            <td className="py-2 font-semibold" style={clvStyle(row.avgClv)}>
              {clvLabel(row.avgClv)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyBetsDashboardPage() {
  const isPro = useTier((s) => s.tier) === "pro";
  const bets = useMyBets((s) => s.bets);
  const { total, wins, losses, pushes, avgClv, sparklinePoints, byBook, byMarket } =
    useDashboardData(bets);

  if (!isPro) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-neutral-100">CLV Dashboard</h1>
        <p className="text-sm text-neutral-500">
          The CLV dashboard is a Pro feature.{" "}
          <Link href="/fairbet" className="underline" style={{ color: "var(--fb-info)" }}>
            Upgrade to Pro
          </Link>{" "}
          to track closing line value across your bets.
        </p>
      </div>
    );
  }

  const hasEnoughData = total >= MIN_BETS_FOR_DASHBOARD;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6" data-testid="clv-dashboard">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings/my-bets"
          className="text-xs text-neutral-500 hover:text-neutral-400 transition"
          data-testid="dashboard-back"
        >
          ← My Bets
        </Link>
        <h1 className="text-xl font-bold text-neutral-100">CLV Dashboard</h1>
      </div>

      {!hasEnoughData ? (
        /* Empty state */
        <div
          className="rounded-lg border p-6 text-center space-y-3"
          style={{ borderColor: "var(--fb-border-subtle)" }}
          data-testid="dashboard-empty"
        >
          <p className="text-sm font-medium text-neutral-300">Not enough data yet</p>
          <p className="text-xs text-neutral-500">
            Log at least {MIN_BETS_FOR_DASHBOARD} bets to see your performance dashboard.
          </p>
          <Link
            href="/fairbet"
            className="inline-block text-xs font-medium px-4 py-2 rounded-md transition"
            style={{
              background: "var(--fb-accent-subtle)",
              color: "var(--fb-info)",
            }}
            data-testid="dashboard-cta"
          >
            Browse FairBet cards →
          </Link>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <section
            className="rounded-lg border p-4 grid grid-cols-2 sm:grid-cols-5 gap-4"
            style={{ borderColor: "var(--fb-border-subtle)" }}
            data-testid="dashboard-summary"
          >
            <Stat label="Total Bets" value={String(total)} />
            <Stat label="Wins" value={String(wins)} />
            <Stat label="Losses" value={String(losses)} />
            <Stat label="Pushes" value={String(pushes)} />
            <Stat
              label="Avg CLV%"
              value={avgClv != null ? clvLabel(avgClv) : "—"}
              valueStyle={avgClv != null ? clvStyle(avgClv) : undefined}
            />
          </section>

          {/* CLV trend sparkline */}
          <section
            className="rounded-lg border p-4 space-y-2"
            style={{ borderColor: "var(--fb-border-subtle)" }}
            data-testid="dashboard-sparkline-section"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-200">CLV% Trend</h2>
              <span className="text-[10px] text-neutral-600">
                Last {Math.min(total, SPARKLINE_MAX_BETS)} bets
              </span>
            </div>
            <Sparkline points={sparklinePoints} />
          </section>

          {/* Per-book breakdown */}
          {byBook.length > 0 && (
            <section
              className="rounded-lg border p-4 space-y-3"
              style={{ borderColor: "var(--fb-border-subtle)" }}
              data-testid="dashboard-book-table"
            >
              <h2 className="text-sm font-semibold text-neutral-200">By Book</h2>
              <BreakdownTable rows={byBook} labelHeader="Book" />
            </section>
          )}

          {/* Per-market breakdown */}
          {byMarket.length > 0 && (
            <section
              className="rounded-lg border p-4 space-y-3"
              style={{ borderColor: "var(--fb-border-subtle)" }}
              data-testid="dashboard-market-table"
            >
              <h2 className="text-sm font-semibold text-neutral-200">By Market</h2>
              <BreakdownTable rows={byMarket} labelHeader="Market" />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase text-neutral-600 font-medium">{label}</span>
      <span
        className="text-lg font-bold text-neutral-100"
        style={valueStyle}
        data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {value}
      </span>
    </div>
  );
}
