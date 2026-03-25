import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics — Monte Carlo Matchup Simulators",
  description:
    "Run Monte Carlo simulations for MLB, NBA, NHL, and NCAAB matchups. Get win probabilities, expected scores, and most likely final scores powered by real-time team data.",
  alternates: { canonical: "/analytics" },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
