"use client";

import type { Game } from "@/lib/types";
import type { GameCore } from "@/stores/game-data";
import { isLive, isFinal, isPregame } from "@/lib/types";
import { useReveal } from "@/stores/reveal";
import { useScoreDisplay } from "@/hooks/useScoreDisplay";
import { usePinnedGames } from "@/stores/pinned-games";
import { pickSnapshot } from "@/lib/score-display";
import { cn, formatDate } from "@/lib/utils";

interface GameHeaderProps {
  game: Game | GameCore;
}

export function GameHeader({ game }: GameHeaderProps) {
  const { reveal, hide, isRevealed } = useReveal();
  const display = useScoreDisplay(game.id);

  const pinned = usePinnedGames((s) => s.isPinned)(game.id);
  const pinnedCount = usePinnedGames((s) => s.pinnedIds.size);
  const togglePin = usePinnedGames((s) => s.togglePin);

  const read = isRevealed(game.id);
  const live = isLive(game.status);
  const final = isFinal(game.status);
  const pregame = isPregame(game.status);

  const hasScoreData = game.homeScore != null && game.awayScore != null;
  const showScore = display?.visible ?? false;

  // On detail page, isActiveView=true so scores always render from live (auto-accept)
  // hasUpdate is always false here since active view
  const hasScoreUpdate = display?.hasUpdate ?? false;

  const handleScoreToggle = () => {
    if (!hasScoreData) return;
    if (read) hide(game.id);
    else reveal(game.id, pickSnapshot(game as GameCore));
  };

  const awayColor = game.awayTeamColorDark || "#888";
  const homeColor = game.homeTeamColorDark || "#888";

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="rounded-xl bg-neutral-800/30 border border-neutral-800/60 px-5 py-5">
        {/* League + date + status */}
        <div className="flex items-center justify-between mb-5">
          <span className="inline-flex items-center gap-2">
            <span className="text-xs uppercase font-medium text-neutral-500 tracking-wide">
              {game.leagueCode.toUpperCase()} &middot; {formatDate(game.gameDate)}
            </span>
            {(pinned || pinnedCount < 10) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(game.id);
                }}
                className={cn(
                  "p-0.5 rounded transition",
                  pinned
                    ? "text-blue-400 hover:text-blue-300"
                    : "text-neutral-600 hover:text-neutral-400",
                )}
                title={pinned ? "Unpin game" : "Pin game"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.09 6.26L21 9.27l-5 4.87L17.18 22 12 18.56 6.82 22 8 14.14l-5-4.87 6.91-1.01L12 2z" />
                </svg>
              </button>
            )}
          </span>
          {live && hasScoreUpdate && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              UPDATED
            </span>
          )}
          {live && !hasScoreUpdate && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
              LIVE
            </span>
          )}
          {final && (
            <span className="text-xs text-neutral-500 uppercase font-medium">Final</span>
          )}
          {pregame && (
            <span className="text-xs text-neutral-500 uppercase font-medium">Upcoming</span>
          )}
        </div>

        {/* Away (left) @ Home (right) — team colors as text */}
        <div className="flex items-center justify-between gap-4">
          {/* Away team */}
          <div className="flex-1 text-center">
            <div
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: awayColor }}
            >
              {game.awayTeamAbbr ?? game.awayTeam}
            </div>
            <div className="text-xs text-neutral-500 mt-1 truncate px-1">
              {game.awayTeam}
            </div>
            {showScore ? (
              <div className="text-4xl font-extrabold tabular-nums mt-2">
                {display?.awayScore}
              </div>
            ) : (
              <div className="text-4xl font-extrabold tabular-nums mt-2 text-neutral-800">
                &nbsp;
              </div>
            )}
          </div>

          {/* Center: toggle reveal */}
          <div
            onClick={handleScoreToggle}
            className={cn(
              "text-center shrink-0",
              !pregame && hasScoreData && "cursor-pointer",
            )}
          >
            {showScore ? (
              <>
                <span className="text-neutral-600 text-sm font-medium">@</span>
                {live && (game.currentPeriodLabel || game.gameClock) && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {game.currentPeriodLabel ?? ""}{game.gameClock ? ` ${game.gameClock}` : ""}
                  </p>
                )}
                {display?.canToggle && (
                  <p className="text-xs text-neutral-700 mt-1 hover:text-neutral-500 transition-colors">
                    Hide score
                  </p>
                )}
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "text-2xl font-bold text-neutral-600",
                    !pregame && hasScoreData && "hover:text-neutral-400 transition-colors",
                  )}
                >
                  vs
                </span>
                {!pregame && hasScoreData && (
                  <p className="text-xs text-neutral-700 mt-1">
                    {live ? "Click to update" : "Click to reveal"}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Home team */}
          <div className="flex-1 text-center">
            <div
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: homeColor }}
            >
              {game.homeTeamAbbr ?? game.homeTeam}
            </div>
            <div className="text-xs text-neutral-500 mt-1 truncate px-1">
              {game.homeTeam}
            </div>
            {showScore ? (
              <div className="text-4xl font-extrabold tabular-nums mt-2">
                {display?.homeScore}
              </div>
            ) : (
              <div className="text-4xl font-extrabold tabular-nums mt-2 text-neutral-800">
                &nbsp;
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
