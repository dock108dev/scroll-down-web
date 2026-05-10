import Link from "next/link";
import type { GameSummary } from "@/lib/types";
import { isFinal, isLive, isPregame } from "@/lib/types";
import { formatGameTime, gamePath } from "@/lib/seo";
import { filterOutTbdGames } from "@/lib/game-filters";

interface SpoilerFreeGameListProps {
  games: GameSummary[];
  showDates?: boolean;
}

function statusLabel(game: GameSummary): string {
  if (isLive(game.status, game)) return "Live";
  if (isFinal(game.status, game)) return "Final";
  if (isPregame(game.status, game)) return formatGameTime(game.gameDate);
  return "Scheduled";
}

export function SpoilerFreeGameList({
  games,
  showDates = false,
}: SpoilerFreeGameListProps) {
  const visibleGames = filterOutTbdGames(games);

  if (visibleGames.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center">
        <p className="text-sm text-neutral-400">No games are available for this window yet.</p>
        <p className="mt-1 text-xs text-neutral-600">Check back closer to game time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visibleGames.map((game) => (
        <Link
          key={game.id}
          href={gamePath(game)}
          className="block rounded-lg border border-neutral-800 bg-neutral-900/45 px-4 py-3 transition hover:border-neutral-700 hover:bg-neutral-900"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-100">
                {game.awayTeam} <span className="text-neutral-600">@</span> {game.homeTeam}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {showDates && (
                  <span>
                    {new Date(game.gameDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "America/New_York",
                    })}{" "}
                    ·{" "}
                  </span>
                )}
                MLB game tracker
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-400">
              {statusLabel(game)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
