"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import type { GameCore } from "@/stores/game-data";
import { isLive, isFinal, isPregame } from "@/lib/types";
import { useReveal } from "@/stores/reveal";
import { useScoreDisplay } from "@/hooks/useScoreDisplay";
import { usePinnedGames } from "@/stores/pinned-games";
import { TeamColorDot } from "@/components/shared/TeamColorDot";
import { cn, cardDisplayName } from "@/lib/utils";
import { pickSnapshot } from "@/lib/score-display";

interface GameCardProps {
  game: GameCore;
}

function hasNoData(game: GameCore): boolean {
  return !game.hasOdds && !game.hasPbp && !game.hasSocial && !game.hasFlow;
}

function formatGameDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleString("en-US", {
    month: "short",
    timeZone: "America/New_York",
  });
  const day = date.toLocaleString("en-US", {
    day: "numeric",
    timeZone: "America/New_York",
  });
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return `${month} ${day} • ${time}`;
}

export const GameCard = memo(function GameCard({ game }: GameCardProps) {
  const router = useRouter();
  const { reveal, hide, acceptUpdate, isRevealed } = useReveal();
  const display = useScoreDisplay(game.id);

  const pinned = usePinnedGames((s) => s.isPinned)(game.id);
  const pinnedCount = usePinnedGames((s) => s.pinnedIds.size);
  const togglePin = usePinnedGames((s) => s.togglePin);

  const read = isRevealed(game.id);
  const final = isFinal(game.status);
  const live = isLive(game.status);
  const pregame = isPregame(game.status);
  const noData = hasNoData(game);

  const hasScoreData = game.homeScore != null && game.awayScore != null;
  const canToggle = display?.canToggle ?? false;
  const scoresVisible = display?.visible ?? false;
  const hasNewData = display?.hasUpdate ?? false;

  const handleCardClick = () => {
    if (!noData) {
      router.push(`/game/${game.id}`);
    }
  };

  const handleScoreToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canToggle) return;

    if (hasNewData) {
      acceptUpdate(game.id, pickSnapshot(game));
      return;
    }

    if (scoresVisible) {
      hide(game.id);
    } else {
      reveal(game.id, pickSnapshot(game));
    }
  };

  // Status label
  const statusLabel = (() => {
    if (live) {
      const snapshot = useReveal.getState().getSnapshot(game.id);
      const timeStr = display?.frozen && snapshot?.periodLabel
        ? `${snapshot.periodLabel}${snapshot.clock ? ` ${snapshot.clock}` : ""}`
        : scoresVisible && (game.currentPeriodLabel || game.gameClock)
          ? `${game.currentPeriodLabel ?? ""}${game.gameClock ? ` ${game.gameClock}` : ""}`
          : "";
      if (hasNewData) {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); acceptUpdate(game.id, pickSnapshot(game)); }}
            className="inline-flex items-center gap-1 text-amber-400 font-semibold cursor-pointer hover:text-amber-300 transition"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
            </span>
            UPDATED
            {timeStr && <span className="text-neutral-500 font-normal text-[10px]">{timeStr}</span>}
          </button>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-green-400 font-semibold">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
          </span>
          LIVE
          {timeStr && <span className="text-neutral-500 font-normal text-[10px]">{timeStr}</span>}
        </span>
      );
    }
    if (final) {
      if (hasNewData) {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); acceptUpdate(game.id, pickSnapshot(game)); }}
            className="inline-flex items-center gap-1 text-amber-400 font-semibold cursor-pointer hover:text-amber-300 transition"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
            </span>
            UPDATED
          </button>
        );
      }
      return <span className="text-neutral-600">Final</span>;
    }
    if (pregame) {
      return (
        <span className="text-neutral-500">{formatGameDateTime(game.gameDate)}</span>
      );
    }
    return null;
  })();

  const scoreTooltip = canToggle
    ? scoresVisible ? "Hide score" : "Reveal score"
    : undefined;

  const hasScoreColumn = !pregame && hasScoreData;

  return (
    <div
      className={cn(
        "relative rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden transition select-none p-3",
        noData && "opacity-40 pointer-events-none",
        read && final && "border-neutral-800/60",
      )}
    >
      {/* Top bar: league left, status right — spans full card width */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="uppercase font-medium text-neutral-500">
            {game.leagueCode}
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.09 6.26L21 9.27l-5 4.87L17.18 22 12 18.56 6.82 22 8 14.14l-5-4.87 6.91-1.01L12 2z" />
              </svg>
            </button>
          )}
        </span>
        <div className="text-right truncate ml-2">{statusLabel}</div>
      </div>

      {/* Body: left 4/5 (teams) + right 1/5 (scores) */}
      <div className="flex">
        {/* Left zone: team names — click opens game */}
        <div
          onClick={handleCardClick}
          className={cn(
            "flex-1 min-w-0 space-y-1.5",
            !noData && "cursor-pointer",
          )}
        >
          {[
            { team: game.awayTeam, abbr: game.awayTeamAbbr, color: game.awayTeamColorDark },
            { team: game.homeTeam, abbr: game.homeTeamAbbr, color: game.homeTeamColorDark },
          ].map(({ team, abbr, color }) => (
            <div key={team} className="flex items-center gap-2 min-w-0 h-5">
              <TeamColorDot color={color} />
              <span className="text-sm truncate" title={team}>
                {cardDisplayName(team, game.leagueCode, abbr)}
              </span>
            </div>
          ))}
        </div>

        {/* Right zone: scores — click toggles reveal/hide */}
        {hasScoreColumn && (
          <div
            onClick={canToggle ? handleScoreToggle : handleCardClick}
            title={scoreTooltip}
            className={cn(
              "shrink-0 flex flex-col items-end justify-start gap-1.5 pl-2",
              canToggle
                ? "cursor-pointer hover:text-neutral-50"
                : "cursor-pointer",
            )}
          >
            <span
              className={cn(
                "text-sm tabular-nums h-5 flex items-center",
                !scoresVisible && "blur-sm select-none",
              )}
            >
              {scoresVisible ? display?.awayScore : game.awayScore}
            </span>
            <span
              className={cn(
                "text-sm tabular-nums h-5 flex items-center",
                !scoresVisible && "blur-sm select-none",
              )}
            >
              {scoresVisible ? display?.homeScore : game.homeScore}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
