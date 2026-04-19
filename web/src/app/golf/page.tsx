import { notFound } from "next/navigation";
import { GolfLeaderboard } from "@/components/golf/GolfLeaderboard";

export default function GolfPage() {
  if (process.env.GOLF_ENABLED !== "true") {
    notFound();
  }

  return (
    <main data-testid="page-golf" className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold text-neutral-50">PGA Tour Leaderboard</h1>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60">
        <GolfLeaderboard />
      </div>
    </main>
  );
}
