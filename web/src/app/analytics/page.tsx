"use client";

import Link from "next/link";
import { AuthGate } from "@/components/auth/AuthGate";
import { AnalyticsTabNav } from "@/features/analytics/components/AnalyticsTabNav";

interface SportCard {
  key: string;
  label: string;
  description: string;
  href: string;
}

const SPORTS: SportCard[] = [
  { key: "mlb", label: "MLB", description: "Matchup Simulator", href: "/analytics/simulator" },
  { key: "nba", label: "NBA", description: "Matchup Simulator", href: "/analytics/nba" },
  { key: "nhl", label: "NHL", description: "Matchup Simulator", href: "/analytics/nhl" },
  { key: "ncaab", label: "NCAAB", description: "Matchup Simulator", href: "/analytics/ncaab" },
];

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-neutral-50">Matchup Simulators</h1>
        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
          Run Monte Carlo simulations on any matchup. Pick two teams, simulate
          thousands of games, and get win probabilities, expected scores, and the
          most likely final outcomes — powered by real-time team performance data.
        </p>
      </div>

      <AnalyticsTabNav />

      <AuthGate
        minRole="user"
        message="Create a free account to run Monte Carlo simulations on any matchup — get win probabilities, projected scores, and the most likely outcomes for every game."
        preview={
          <div className="space-y-4 select-none pointer-events-none">
            {/* Sample simulation result */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3 opacity-70 blur-[1px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Sample Result</p>
                  <p className="text-sm font-semibold text-neutral-200 mt-1">Yankees vs Red Sox</p>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">10,000 sims</span>
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
            <div className="grid grid-cols-2 gap-3 opacity-60 blur-[2px]">
              {SPORTS.map((sport) => (
                <div
                  key={sport.key}
                  className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6"
                >
                  <span className="text-lg font-bold text-neutral-50">
                    {sport.label}
                  </span>
                  <span className="text-xs text-neutral-400 mt-1">
                    {sport.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {SPORTS.map((sport) => (
            <Link
              key={sport.key}
              href={sport.href}
              className="group relative flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6 transition hover:border-neutral-700 hover:bg-neutral-800/80"
            >
              <span className="text-lg font-bold text-neutral-50">
                {sport.label}
              </span>
              <span className="text-xs text-neutral-400 mt-1">
                {sport.description}
              </span>
            </Link>
          ))}
        </div>
      </AuthGate>
    </div>
  );
}
