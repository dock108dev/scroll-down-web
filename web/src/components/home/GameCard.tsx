"use client";

import { useRouter } from "next/navigation";
import type { GameSummary } from "@/lib/types";
import { isLive, isFinal, isPregame } from "@/lib/types";
import { useReadState } from "@/stores/read-state";
import { useSettings } from "@/stores/settings";
import { TeamColorDot } from "@/components/shared/TeamColorDot";
import { cn } from "@/lib/utils";
import { useRef } from "react";
import { useReadingPosition } from "@/stores/reading-position";

interface GameCardProps {
  game: GameSummary;
}

/** Returns true when a game has no meaningful data at all. */
function hasNoData(game: GameSummary): boolean {
  return !game.hasOdds && !game.hasPbp && !game.hasSocial && !game.hasFlow;
}

/** Format a game date for display on card. E.g. "Feb 23 • 7:10 PM" */
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

export function GameCard({ game }: GameCardProps) {
  const router = useRouter();
  const { isRead, markRead, markUnread } = useReadState();
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const savedPosition = useReadingPosition((s) => s.getPosition)(game.id);
  const savePosition = useReadingPosition((s) => s.savePosition);

  const read = isRead(game.id);
  const final = isFinal(game.status);
  const live = isLive(game.status);
  const pregame = isPregame(game.status);
  const noData = hasNoData(game);

  const hasScoreData = game.homeScore != null && game.awayScore != null;

  const showScore =
    !pregame &&
    hasScoreData &&
    (scoreRevealMode === "always" || read);

  const displayAwayScore = showScore
    ? game.awayScore
    : savedPosition?.awayScore != null && !pregame
      ? savedPosition.awayScore
      : null;
  const displayHomeScore = showScore
    ? game.homeScore
    : savedPosition?.homeScore != null && !pregame
      ? savedPosition.homeScore
      : null;
  const hasSavedScores = displayAwayScore != null && displayHomeScore != null;

  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardClick = () => {
    if (!noData) {
      router.push(`/game/${game.id}`);
    }
  };

  const handleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    markRead(game.id, game.status);
    // Save current scores so the detail page shows the same values
    if (hasScoreData) {
      savePosition(game.id, {
        playIndex: -1,
        homeScore: game.homeScore ?? undefined,
        awayScore: game.awayScore ?? undefined,
        period: game.currentPeriod,
        gameClock: game.gameClock,
        periodLabel: game.currentPeriodLabel ?? undefined,
        timeLabel: game.currentPeriodLabel
          ? `${game.currentPeriodLabel}${game.gameClock ? ` ${game.gameClock}` : ""}`
          : undefined,
        savedAt: new Date().toISOString(),
      });
    }
  };

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation();
    markUnread(game.id);
  };

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className={cn(
        "relative rounded-lg border border-neutral-800 bg-neutral-900 p-3 transition select-none",
        noData && "opacity-40 pointer-events-none",
        !noData && "cursor-pointer hover:border-neutral-700",
        read && final && "border-neutral-800/60",
      )}
    >
      {/* Top bar: league badge + status */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="uppercase font-medium text-neutral-500">
          {game.leagueCode}
        </span>
        <div className="flex items-center gap-2">
          {live && (
            <span className="inline-flex items-center gap-1 text-green-400 font-semibold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
              </span>
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Teams + Scores */}
      <div className="space-y-1.5">
        {/* Away team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <TeamColorDot color={game.awayTeamColorDark} />
            <span className="text-sm truncate">
              {game.awayTeamAbbr ?? game.awayTeam}
            </span>
          </div>
          {pregame ? (
            <span />
          ) : showScore || hasSavedScores ? (
            <span className="text-sm font-mono tabular-nums">
              {displayAwayScore}
            </span>
          ) : hasScoreData ? (
            <span className="text-sm font-mono tabular-nums blur-sm select-none">
              {game.awayScore}
            </span>
          ) : (
            <span />
          )}
        </div>

        {/* Home team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <TeamColorDot color={game.homeTeamColorDark} />
            <span className="text-sm truncate">
              {game.homeTeamAbbr ?? game.homeTeam}
            </span>
          </div>
          {pregame ? (
            <span />
          ) : showScore || hasSavedScores ? (
            <span className="text-sm font-mono tabular-nums">
              {displayHomeScore}
            </span>
          ) : hasScoreData ? (
            <span className="text-sm font-mono tabular-nums blur-sm select-none">
              {game.homeScore}
            </span>
          ) : (
            <span />
          )}
        </div>
      </div>

      {/* Game clock for live games */}
      {live && showScore && (game.currentPeriodLabel || game.gameClock) && (
        <div className="mt-1 text-[10px] text-neutral-500 text-center">
          @ {game.currentPeriodLabel ?? ""}{game.gameClock ? ` ${game.gameClock}` : ""}
        </div>
      )}

      {/* Bottom info */}
      <div className="mt-2 flex items-center text-[11px] text-neutral-500">
        <div className="flex-1" />
        <div className="flex-1 text-center">
          {pregame && (
            <span>{formatGameDateTime(game.gameDate)}</span>
          )}
          {live && !showScore && hasSavedScores && savedPosition?.timeLabel && (
            <span>@ {savedPosition.timeLabel}</span>
          )}
          {final && showScore && (
            <span className="text-neutral-600">Final</span>
          )}
        </div>
        <div className="flex-1 text-right">
          {(final || live) && !showScore && scoreRevealMode !== "always" && (
            <button
              onClick={handleReveal}
              className="text-[11px] text-neutral-400 hover:text-white transition underline underline-offset-2"
            >
              Reveal
            </button>
          )}
          {(final || live) && showScore && scoreRevealMode !== "always" && (
            <button
              onClick={handleHide}
              className="text-[11px] text-neutral-400 hover:text-white transition underline underline-offset-2"
            >
              Hide
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
