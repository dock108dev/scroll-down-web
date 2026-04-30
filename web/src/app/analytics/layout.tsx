import type { Metadata } from "next";
import { buildSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = buildSeoMetadata({
  title: "Analytics - MLB Forecasts & Matchup Simulators",
  description:
    "Daily MLB predictions with market edge analysis, plus Monte Carlo simulators for MLB, NBA, NHL, and NCAAB matchups. Win probabilities, projected scores, and EV analysis powered by ML models.",
  path: "/analytics",
});

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
