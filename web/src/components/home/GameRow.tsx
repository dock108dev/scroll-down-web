"use client";

import { memo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameCore } from "@/stores/game-data";
import { isLive, isFinal, isPregame } from "@/lib/types";
import { useReveal } from "@/stores/reveal";
import { useScoreDisplay } from "@/hooks/useScoreDisplay";
import { usePinnedGames } from "@/stores/pinned-games";
import { cn, cardDisplayName } from "@/lib/utils";
import { pickSnapshot } from "@/lib/score-display";

interface GameRowProps {
  game: GameCore;
  showPin?: boolean;
  variant?: "home" | "history";
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

function formatHistoryDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const monthDay = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return `${monthDay} · ${time} ET`;
}

export const GameRow = memo(function GameRow({ game, showPin = true, variant = "home" }: GameRowProps) {
  const isHistory = variant === "history";
  const router = useRouter();
  const { reveal, acceptUpdate, isRevealed } = useReveal();
  const display = useScoreDisplay(game.id);

  const pinned = usePinnedGames((s) => s.isPinned)(game.id);
  const pinnedCount = usePinnedGames((s) => s.pinnedIds.size);
  const togglePin = usePinnedGames((s) => s.togglePin);

  const read = isRevealed(game.id);
  const final = isFinal(game.status, game);
  const live = isLive(game.status, game);
  const pregame = isPregame(game.status, game);
  const noData = hasNoData(game);

  const hasScoreData = game.homeScore != null && game.awayScore != null;
  const canToggle = display?.canToggle ?? false;
  const scoresVisible = display?.visible ?? false;
  const hasNewData = display?.hasUpdate ?? false;

  // ── Score flash animation ─────────────────────────────────────
  const prevAwayRef = useRef(display?.awayScore);
  const prevHomeRef = useRef(display?.homeScore);
  const [scoreFlash, setScoreFlash] = useState(false);

  useEffect(() => {
    const pA = prevAwayRef.current, pH = prevHomeRef.current;
    prevAwayRef.current = display?.awayScore;
    prevHomeRef.current = display?.homeScore;
    if (scoresVisible && pA != null && pH != null &&
        display?.awayScore != null && display?.homeScore != null &&
        (pA !== display.awayScore || pH !== display.homeScore)) {
      setScoreFlash(true);
    }
  }, [display?.awayScore, display?.homeScore, scoresVisible]);

  useEffect(() => {
    if (scoreFlash) {
      const t = setTimeout(() => setScoreFlash(false), 400);
      return () => clearTimeout(t);
    }
  }, [scoreFlash]);

  // ── Hide mode update pulse ──────────────────────────────────
  const prevHasNewRef = useRef(hasNewData);
  const [updatePulse, setUpdatePulse] = useState(false);

  useEffect(() => {
    const prev = prevHasNewRef.current;
    prevHasNewRef.current = hasNewData;
    if (!prev && hasNewData && canToggle && !scoresVisible) setUpdatePulse(true);
  }, [hasNewData, canToggle, scoresVisible]);

  useEffect(() => {
    if (updatePulse) {
      const t = setTimeout(() => setUpdatePulse(false), 500);
      return () => clearTimeout(t);
    }
  }, [updatePulse]);

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

  // ── Live clock string (used in score zone) ──────────────────
  const liveTimeStr = (() => {
    if (!live) return "";
    const showClock = scoresVisible;
    const snapshot = useReveal.getState().getSnapshot(game.id);
    return display?.frozen && snapshot?.periodLabel
      ? `${snapshot.periodLabel}${snapshot.clock ? ` ${snapshot.clock}` : ""}`
      : showClock && (game.currentPeriodLabel || game.gameClock)
        ? `${game.currentPeriodLabel ?? ""}${game.gameClock ? ` ${game.gameClock}` : ""}`
        : "";
  })();

  // ── Status indicator ──────────────────────────────────────────

  const statusContent = (() => {
    if (live) {
      if (hasNewData) {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); acceptUpdate(game.id, pickSnapshot(game)); }}
            className="inline-flex items-center gap-1 text-amber-400 font-semibold text-xs cursor-pointer hover:text-amber-300 transition"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-live-dot absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
            </span>
            UPD
          </button>
        );
      }

      return (
        <span className="inline-flex items-center gap-1 text-green-400 font-semibold text-xs">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-live-dot absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
          </span>
          LIVE
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
              <span className="animate-live-dot absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
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
    // Pregame: nothing. Also hide if no score data anywhere (core or display snapshot).
    const hasDisplayScores = display?.homeScore != null && display?.awayScore != null;
    if (pregame || (!hasScoreData && !hasDisplayScores)) return null;

    // Hide mode + unrevealed: reveal button
    if (canToggle && !scoresVisible) {
      return (
        <button
          onClick={handleReveal}
          className={cn(
            "shrink-0 flex items-center gap-1.5 rounded-lg bg-neutral-800/40 border border-neutral-700/30 ml-3 text-blue-400 hover:text-blue-300 transition min-w-[96px] min-h-[44px] justify-center",
            updatePulse && "update-pulse",
          )}
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
    // Live games: clicking score refreshes it (or no-op if unchanged), not navigate
    if (live) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasNewData) {
              acceptUpdate(game.id, pickSnapshot(game));
            }
          }}
          className={cn(
            "shrink-0 pl-3 min-w-[96px] min-h-[44px] flex items-center justify-end text-right gap-2",
            scoreFlash && "score-flash",
          )}
        >
          {liveTimeStr && <span className="text-neutral-500 text-[11px] font-normal whitespace-nowrap">{liveTimeStr}</span>}
          <span className="text-base font-semibold tabular-nums text-neutral-200">{display?.awayScore ?? game.awayScore} {"\u2013"} {display?.homeScore ?? game.homeScore}</span>
        </button>
      );
    }

    return (
      <span className={cn(
        "shrink-0 text-base font-semibold tabular-nums text-neutral-200 pl-3 text-right min-w-[96px]",
        scoreFlash && "score-flash",
      )}>
        {display?.awayScore ?? game.awayScore} {"\u2013"} {display?.homeScore ?? game.homeScore}
      </span>
    );
  })();

  return (
    <div
      onClick={handleNavigate}
      className={cn(
        "flex items-center min-h-[52px] px-4 py-3 border-b border-neutral-800/40 transition select-none",
        noData && "opacity-40 pointer-events-none",
        !isHistory && read && final && "opacity-70",
        !noData && "cursor-pointer hover:bg-neutral-800/40 active:bg-neutral-800/50",
      )}
    >
      {/* Left: league + pin + status */}
      <div className="shrink-0 w-[88px] flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1">
          <span className="uppercase font-medium text-neutral-500 text-xs">
            {game.leagueCode}
          </span>
          {showPin && (pinned || pinnedCount < 10) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePin(game.id);
              }}
              className={cn(
                "p-0.5 rounded transition",
                pinned
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-neutral-600 opacity-40 hover:text-neutral-400",
              )}
              title={pinned ? "Unpin game" : "Pin game"}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.09 6.26L21 9.27l-5 4.87L17.18 22 12 18.56 6.82 22 8 14.14l-5-4.87 6.91-1.01L12 2z" />
              </svg>
            </button>
          )}
        </span>
        {statusContent}
      </div>

      {/* Center: matchup */}
      <div className="flex-1 min-w-0 text-[15px] font-medium text-neutral-200 truncate leading-snug">
        {cardDisplayName(game.awayTeam, game.leagueCode, game.awayTeamAbbr)}
        {" @ "}
        {cardDisplayName(game.homeTeam, game.leagueCode, game.homeTeamAbbr)}
      </div>

      {/* Right: score zone or history date/time */}
      {isHistory ? (
        <span className="shrink-0 text-xs text-neutral-500 pl-3 text-right min-w-[96px]">
          {formatHistoryDateTime(game.gameDate)}
        </span>
      ) : scoreZone}
    </div>
  );
});
