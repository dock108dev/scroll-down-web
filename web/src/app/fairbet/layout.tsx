import type { Metadata } from "next";
import { buildSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = buildSeoMetadata({
  title: "FairBet - Sports Betting Odds Comparison & EV Finder",
  description:
    "Compare real-time sports betting odds across DraftKings, FanDuel, BetMGM, and more. Find positive expected value bets and build parlays with fair probability estimates.",
  path: "/fairbet",
});

export default function FairBetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
