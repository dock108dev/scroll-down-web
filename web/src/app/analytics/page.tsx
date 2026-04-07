"use client";

import Link from "next/link";
import { AuthGate } from "@/components/auth/AuthGate";
import { AnalyticsTabNav } from "@/features/analytics/components/AnalyticsTabNav";

interface FeatureCard {
  key: string;
  label: string;
  description: string;
  href: string;
}

const FEATURES: FeatureCard[] = [
  {
    key: "forecasts",
    label: "Today's Forecasts",
    description: "Pre-computed MLB predictions with market edge analysis",
    href: "/analytics/forecasts",
  },
  {
    key: "mlb",
    label: "MLB Simulator",
    description: "Lineup-aware Monte Carlo simulation",
    href: "/analytics/simulator",
  },
  {
    key: "nba",
    label: "NBA Simulator",
    description: "Possession-based matchup simulation",
    href: "/analytics/nba",
  },
  {
    key: "nhl",
    label: "NHL Simulator",
    description: "Shot-level matchup simulation",
    href: "/analytics/nhl",
  },
  {
    key: "ncaab",
    label: "NCAAB Simulator",
    description: "Four-factor matchup simulation",
    href: "/analytics/ncaab",
  },
];

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-neutral-50">Analytics</h1>
        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
          Daily MLB forecasts refreshed hourly, plus Monte Carlo simulators for
          any matchup across four sports — powered by real-time performance data
          and ML models.
        </p>
      </div>

      <AnalyticsTabNav />

      <AuthGate
        minRole="user"
        message="Create a free account to access daily forecasts, run Monte Carlo simulations, and get win probabilities for every game."
        preview={
          <div className="space-y-4 select-none pointer-events-none">
            {/* Sample forecast cards */}
            <div className="space-y-3 opacity-80 blur-[1px]">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Today&apos;s Top Edge</p>
                    <p className="text-sm font-semibold text-neutral-200 mt-1">Red Sox @ Yankees</p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">+4.2% EV</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-neutral-800 p-3">
                    <p className="text-lg font-bold text-green-400">58.2%</p>
                    <p className="text-[10px] text-neutral-500">Win Probability</p>
                  </div>
                  <div className="rounded-lg bg-neutral-800 p-3">
                    <p className="text-lg font-bold text-neutral-200">5.3 – 4.1</p>
                    <p className="text-[10px] text-neutral-500">Projected Score</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Value Pick</p>
                    <p className="text-sm font-semibold text-neutral-200 mt-1">Dodgers @ Padres</p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">+3.1% EV</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-neutral-800 p-3">
                    <p className="text-lg font-bold text-green-400">52.7%</p>
                    <p className="text-[10px] text-neutral-500">Win Probability</p>
                  </div>
                  <div className="rounded-lg bg-neutral-800 p-3">
                    <p className="text-lg font-bold text-neutral-200">4.8 – 3.6</p>
                    <p className="text-[10px] text-neutral-500">Projected Score</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Sample simulator cards */}
            <div className="grid grid-cols-2 gap-3 opacity-60 blur-[1px]">
              {FEATURES.slice(1).map((f) => (
                <div
                  key={f.key}
                  className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6"
                >
                  <span className="text-lg font-bold text-neutral-50">
                    {f.label}
                  </span>
                  <span className="text-xs text-neutral-400 mt-1">
                    {f.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Forecasts — hero card */}
          <Link
            href={FEATURES[0].href}
            className="group block rounded-xl border border-blue-900/50 bg-gradient-to-br from-blue-950/40 to-neutral-900 px-5 py-5 transition hover:border-blue-800/60"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-base font-bold text-neutral-50">
                  {FEATURES[0].label}
                </span>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {FEATURES[0].description}
                </p>
              </div>
              <span className="text-sm text-blue-400 group-hover:translate-x-0.5 transition-transform">
                &rarr;
              </span>
            </div>
          </Link>

          {/* Simulators — grid */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.slice(1).map((f) => (
              <Link
                key={f.key}
                href={f.href}
                className="group relative flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6 transition hover:border-neutral-700 hover:bg-neutral-800/80"
              >
                <span className="text-lg font-bold text-neutral-50">
                  {f.label}
                </span>
                <span className="text-xs text-neutral-400 mt-1 text-center">
                  {f.description}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </AuthGate>
    </div>
  );
}
