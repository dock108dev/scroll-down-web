"use client";

import Link from "next/link";
import { AuthGate } from "@/components/auth/AuthGate";

interface SportCard {
  key: string;
  label: string;
  description: string;
  href: string;
  enabled: boolean;
}

const SPORTS: SportCard[] = [
  {
    key: "mlb",
    label: "MLB",
    description: "Matchup Simulator",
    href: "/analytics/mlb",
    enabled: true,
  },
  {
    key: "nba",
    label: "NBA",
    description: "Matchup Simulator",
    href: "/analytics/nba",
    enabled: false,
  },
  {
    key: "nfl",
    label: "NFL",
    description: "Matchup Simulator",
    href: "/analytics/nfl",
    enabled: false,
  },
  {
    key: "nhl",
    label: "NHL",
    description: "Matchup Simulator",
    href: "/analytics/nhl",
    enabled: false,
  },
  {
    key: "ncaab",
    label: "NCAAB",
    description: "Matchup Simulator",
    href: "/analytics/ncaab",
    enabled: false,
  },
  {
    key: "ncaaf",
    label: "NCAAF",
    description: "Matchup Simulator",
    href: "/analytics/ncaaf",
    enabled: false,
  },
];

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-neutral-50">Analytics</h1>
        <p className="text-xs text-neutral-500 mt-1">
          Monte Carlo matchup simulators powered by real-time data.
        </p>
      </div>

      <AuthGate
        minRole="user"
        message="Sign up for free to access analytics tools"
      >
        <div className="grid grid-cols-2 gap-3">
          {SPORTS.map((sport) =>
            sport.enabled ? (
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
            ) : (
              <div
                key={sport.key}
                className="relative flex flex-col items-center justify-center rounded-xl border border-neutral-800/50 bg-neutral-900/50 px-4 py-6 opacity-50 cursor-not-allowed select-none"
              >
                <span className="text-lg font-bold text-neutral-500">
                  {sport.label}
                </span>
                <span className="text-xs text-neutral-600 mt-1">
                  {sport.description}
                </span>
                <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 bg-neutral-800/60 rounded px-1.5 py-0.5">
                  Coming Soon
                </span>
              </div>
            ),
          )}
        </div>
      </AuthGate>
    </div>
  );
}
