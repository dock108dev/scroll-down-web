"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import type { GameCore } from "@/stores/game-data";
import { isLive, isFinal, isPregame } from "@/lib/types";
import { useReveal } from "@/stores/reveal";
import { useScoreDisplay } from "@/hooks/useScoreDisplay";
import { cn, cardDisplayName } from "@/lib/utils";
import { pickSnapshot } from "@/lib/score-display";

interface GameRowProps {
  game: GameCore;
}

function hasNoData(game: GameCore): boolean {
  return !game.hasOdds && !game.hasPbp && !game.hasSocial && !game.hasFlow;
}

function formatGameDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return `${time} ET`;
}

export const GameRow = memo(function GameRow({ game }: GameRowProps) {
  const router = useRouter();
  const { reveal, acceptUpdate, isRevealed } = useReveal();
  const display = useScoreDisplay(game.id);

  const read = isRevealed(game.id);
  const final = isFinal(game.status);
  const live = isLive(game.status);
  const pregame = isPregame(game.status);
  const noData = hasNoData(game);

  const hasScoreData = game.homeScore != null && game.awayScore != null;
  const canToggle = display?.canToggle ?? false;
  const scoresVisible = display?.visible ?? false;
  const hasNewData = display?.hasUpdate ?? false;

  const handleNavigate = () => {
    if (!noData) {
      router.push(`/game/${game.id}`);
    }
  };

  const handleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasNewData) {
      acceptUpdate(game.id, pickSnapshot(game));
    } else {
      reveal(game.id, pickSnapshot(game));
    }
  };

  // ── Status indicator ──────────────────────────────────────────

  const statusContent = (() => {
    if (live) {
      // In hide mode (unrevealed): show "LIVE" only, no clock/period
      // Once revealed or in normal mode: show full clock/period
      const showClock = scoresVisible;
      const snapshot = useReveal.getState().getSnapshot(game.id);
      const timeStr = display?.frozen && snapshot?.periodLabel
        ? `${snapshot.periodLabel}${snapshot.clock ? ` ${snapshot.clock}` : ""}`
        : showClock && (game.currentPeriodLabel || game.gameClock)
          ? `${game.currentPeriodLabel ?? ""}${game.gameClock ? ` ${game.gameClock}` : ""}`
          : "";

      if (hasNewData) {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); acceptUpdate(game.id, pickSnapshot(game)); }}
            className="inline-flex items-center gap-1 text-amber-400 font-semibold text-xs cursor-pointer hover:text-amber-300 transition"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
            </span>
            UPD
            {timeStr && <span className="text-neutral-500 font-normal text-[10px]">{timeStr}</span>}
          </button>
        );
      }

      return (
        <span className="inline-flex items-center gap-1 text-green-400 font-semibold text-xs">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
          </span>
          LIVE
          {timeStr && <span className="text-neutral-500 font-normal text-[10px] ml-0.5">{timeStr}</span>}
        </span>
      );
    }

    if (final) {
      if (hasNewData) {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); acceptUpdate(game.id, pickSnapshot(game)); }}
            className="inline-flex items-center gap-1 text-amber-400 font-semibold text-xs cursor-pointer hover:text-amber-300 transition"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
            </span>
            UPD
          </button>
        );
      }
      return <span className="text-neutral-600 text-xs">Final</span>;
    }

    if (pregame) {
      return <span className="text-neutral-500 text-xs">{formatGameDateTime(game.gameDate)}</span>;
    }

    return null;
  })();

  // ── Score zone ────────────────────────────────────────────────

  const scoreZone = (() => {
    // Pregame: nothing
    if (pregame || !hasScoreData) return null;

    // Hide mode + unrevealed: reveal button
    if (canToggle && !scoresVisible) {
      return (
        <button
          onClick={handleReveal}
          className="shrink-0 flex items-center gap-1.5 pl-3 border-l border-neutral-800 text-blue-400 hover:text-blue-300 transition min-w-[88px] min-h-[44px] justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-xs font-medium">Reveal</span>
        </button>
      );
    }

    // Scores visible (normal mode or revealed)
    return (
      <span className="shrink-0 text-sm tabular-nums text-neutral-200 pl-3">
        {display?.awayScore ?? game.awayScore} - {display?.homeScore ?? game.homeScore}
      </span>
    );
  })();

  return (
    <div
      onClick={handleNavigate}
      className={cn(
        "flex items-center min-h-[52px] px-4 py-2.5 border-b border-neutral-800 transition select-none",
        noData && "opacity-40 pointer-events-none",
        read && final && "opacity-70",
        !noData && "cursor-pointer active:bg-neutral-800/50",
      )}
    >
      {/* Left: league + status */}
      <div className="shrink-0 w-[88px] flex flex-col gap-0.5">
        <span className="uppercase font-medium text-neutral-500 text-xs">
          {game.leagueCode}
        </span>
        {statusContent}
      </div>

      {/* Center: matchup */}
      <div className="flex-1 min-w-0 text-sm text-neutral-200 truncate">
        {cardDisplayName(game.awayTeam, game.leagueCode, game.awayTeamAbbr)}
        {" @ "}
        {cardDisplayName(game.homeTeam, game.leagueCode, game.homeTeamAbbr)}
      </div>

      {/* Right: score zone */}
      {scoreZone}
    </div>
  );
});
