import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FairBet — Sports Betting Odds Comparison & EV Finder",
  description:
    "Compare real-time sports betting odds across DraftKings, FanDuel, BetMGM, and more. Find positive expected value (+EV) bets and build parlays with fair probability estimates.",
  alternates: { canonical: "/fairbet" },
};

export default function FairBetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
