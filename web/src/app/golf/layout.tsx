import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PGA Tour Golf — Tournaments & Leaderboards",
  description:
    "Follow PGA Tour tournaments with live leaderboards, results, and upcoming schedule. No spoilers, catch up on your own time.",
  alternates: { canonical: "/golf" },
};

export default function GolfLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
