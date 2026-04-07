import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics — MLB Forecasts & Matchup Simulators",
  description:
    "Daily MLB predictions with market edge analysis, plus Monte Carlo simulators for MLB, NBA, NHL, and NCAAB matchups. Win probabilities, projected scores, and EV analysis powered by ML models.",
  alternates: { canonical: "/analytics" },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
