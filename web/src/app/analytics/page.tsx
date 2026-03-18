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
  {
    key: "mlb",
    label: "MLB",
    description: "Matchup Simulator",
    href: "/analytics/simulator",
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
