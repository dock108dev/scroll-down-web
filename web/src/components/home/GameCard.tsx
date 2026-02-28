"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { GameSummary } from "@/lib/types";
import { isLive, isFinal, isPregame } from "@/lib/types";
import { useReadState } from "@/stores/read-state";
import { useSettings } from "@/stores/settings";
import { TeamColorDot } from "@/components/shared/TeamColorDot";
import { cn, cardDisplayName } from "@/lib/utils";
import { useReadingPosition } from "@/stores/reading-position";

interface GameCardProps {
  game: GameSummary;
}

function hasNoData(game: GameSummary): boolean {
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

export function GameCard({ game }: GameCardProps) {
  const router = useRouter();
  const { isRead, markRead, markUnread } = useReadState();
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const savedPosition = useReadingPosition((s) => s.getPosition)(game.id);
  const savePosition = useReadingPosition((s) => s.savePosition);
  const clearPosition = useReadingPosition((s) => s.clearPosition);

  const read = isRead(game.id);
  const final = isFinal(game.status);
  const live = isLive(game.status);
  const pregame = isPregame(game.status);
  const noData = hasNoData(game);

  // Track previous live status for live→final auto-hide
  const wasLiveRef = useRef(live);
  useEffect(() => {
    // Game just went final while user had it revealed as live
    if (final && wasLiveRef.current && read && savedPosition) {
      markUnread(game.id);
      clearPosition(game.id);
    }
    wasLiveRef.current = live;
  }, [final, live, read, savedPosition, game.id, markUnread, clearPosition]);

  const hasScoreData = game.homeScore != null && game.awayScore != null;

  const showScore =
    !pregame &&
    hasScoreData &&
    (scoreRevealMode === "always" || read);

  // Score freeze: when a live game is revealed (not "always" mode),
  // display the snapshot scores instead of live-updating ones.
  const scoreFrozen =
    live &&
    read &&
    scoreRevealMode !== "always" &&
    savedPosition?.homeScore != null &&
    savedPosition?.awayScore != null;

  const hasNewData =
    scoreFrozen &&
    (game.homeScore !== savedPosition!.homeScore ||
      game.awayScore !== savedPosition!.awayScore ||
      (game.playCount != null &&
        savedPosition!.playCount != null &&
        game.playCount > savedPosition!.playCount));

  const displayAwayScore = scoreFrozen
    ? savedPosition!.awayScore
    : showScore
      ? game.awayScore
      : savedPosition?.awayScore != null && !pregame
        ? savedPosition.awayScore
        : null;
  const displayHomeScore = scoreFrozen
    ? savedPosition!.homeScore
    : showScore
      ? game.homeScore
      : savedPosition?.homeScore != null && !pregame
        ? savedPosition.homeScore
        : null;
  const hasSavedScores = displayAwayScore != null && displayHomeScore != null;

  const canToggle = (final || live) && hasScoreData && scoreRevealMode !== "always";
  const scoresVisible = showScore || hasSavedScores;

  const handleCardClick = () => {
    if (!noData) {
      router.push(`/game/${game.id}`);
    }
  };

  const freshSnapshot = () => {
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
      playCount: game.playCount,
      savedAt: new Date().toISOString(),
    });
  };

  const handleScoreToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canToggle) return;

    // When showing UPDATED, click refreshes to latest scores
    if (hasNewData) {
      freshSnapshot();
      return;
    }

    if (scoresVisible) {
      markUnread(game.id);
      clearPosition(game.id);
    } else {
      markRead(game.id, game.status);
      if (hasScoreData) {
        freshSnapshot();
      }
    }
  };

  // Status label
  const statusLabel = (() => {
    if (live) {
      const timeStr = scoreFrozen && savedPosition?.timeLabel
        ? savedPosition.timeLabel
        : showScore && (game.currentPeriodLabel || game.gameClock)
          ? `${game.currentPeriodLabel ?? ""}${game.gameClock ? ` ${game.gameClock}` : ""}`
          : !showScore && hasSavedScores && savedPosition?.timeLabel
            ? savedPosition.timeLabel
            : "";
      if (hasNewData) {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); freshSnapshot(); }}
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
        <span className="uppercase font-medium text-neutral-500">
          {game.leagueCode}
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
                ? "cursor-pointer hover:text-white"
                : "cursor-pointer",
            )}
          >
            <span
              className={cn(
                "text-sm font-mono tabular-nums h-5 flex items-center",
                !scoresVisible && "blur-sm select-none",
              )}
            >
              {scoresVisible ? displayAwayScore : game.awayScore}
            </span>
            <span
              className={cn(
                "text-sm font-mono tabular-nums h-5 flex items-center",
                !scoresVisible && "blur-sm select-none",
              )}
            >
              {scoresVisible ? displayHomeScore : game.homeScore}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
