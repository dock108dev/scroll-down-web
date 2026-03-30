"use client";

import Link from "next/link";
import { AuthGate } from "@/components/auth/AuthGate";

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

      <AuthGate
        minRole="user"
        message="Create a free account to run Monte Carlo simulations on any matchup — get win probabilities, projected scores, and the most likely outcomes for every game."
        preview={
          <div className="grid grid-cols-2 gap-3 select-none pointer-events-none blur-[2px] opacity-60">
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
