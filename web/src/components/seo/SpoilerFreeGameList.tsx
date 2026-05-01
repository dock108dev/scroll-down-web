import Link from "next/link";
import type { GameSummary } from "@/lib/types";
import { isFinal, isLive, isPregame } from "@/lib/types";
import { SeoContentAd } from "@/components/ads/SeoContentAd";
import {
  formatGameTime,
  gamePath,
  leagueLabel,
  slugifyTeamName,
} from "@/lib/seo";

interface SpoilerFreeGameListProps {
  games: GameSummary[];
  showDates?: boolean;
  showLeagues?: boolean;
  includeAds?: boolean;
}

function statusLabel(game: GameSummary): string {
  if (isLive(game.status, game)) return "Live";
  if (isFinal(game.status, game)) return "Final";
  if (isPregame(game.status, game)) return formatGameTime(game.gameDate);
  return "Scheduled";
}

function uniqueTeams(games: GameSummary[]): Array<{ name: string; slug: string }> {
  const seen = new Map<string, string>();
  for (const game of games) {
    seen.set(slugifyTeamName(game.awayTeam), game.awayTeam);
    seen.set(slugifyTeamName(game.homeTeam), game.homeTeam);
  }
  return Array.from(seen, ([slug, name]) => ({ slug, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function SpoilerFreeGameList({
  games,
  showDates = false,
  showLeagues = true,
  includeAds = true,
}: SpoilerFreeGameListProps) {
  if (games.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center">
        <p className="text-sm text-neutral-400">No games are available for this window yet.</p>
        <p className="mt-1 text-xs text-neutral-600">Check back closer to game time.</p>
      </div>
    );
  }

  const teams = uniqueTeams(games);

  return (
    <div className="space-y-4">
      {includeAds && <SeoContentAd position="intro" />}
      <div className="space-y-2">
        {games.map((game, index) => (
          <div key={game.id} className="space-y-2">
            <Link
              href={gamePath(game)}
              className="block rounded-lg border border-neutral-800 bg-neutral-900/45 px-4 py-3 transition hover:border-neutral-700 hover:bg-neutral-900"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-100">
                    {game.awayTeam} <span className="text-neutral-600">@</span> {game.homeTeam}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {showLeagues && <span>{leagueLabel(game.leagueCode)} · </span>}
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
                    Game tracker
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-400">
                  {statusLabel(game)}
                </span>
              </div>
            </Link>
            {includeAds && index === 4 && <SeoContentAd position="inline" />}
          </div>
        ))}
      </div>

      {teams.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-4">
          <h2 className="text-sm font-semibold text-neutral-200">Teams in this window</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {teams.slice(0, 24).map((team) => (
              <Link
                key={team.slug}
                href={`/teams/${team.slug}`}
                className="rounded-full border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200"
              >
                {team.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {includeAds && <SeoContentAd position="bottom" />}
    </div>
  );
}
