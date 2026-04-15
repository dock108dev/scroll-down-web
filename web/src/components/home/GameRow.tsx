"use client";

import { memo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SafeGameCore } from "@/stores/game-data";
import { isLive, isFinal, isPregame } from "@/lib/types";
import { useReveal } from "@/stores/reveal";
import { useSpoilerGate } from "@/hooks/useSpoilerGate";
import { usePinnedGames } from "@/stores/pinned-games";
import { cn, cardDisplayName, formatTimeET, resolveTeamColor } from "@/lib/utils";
import { LeagueBadge } from "@/components/fairbet/LeagueBadge";
import { FreshnessBadge } from "@/components/shared/FreshnessBadge";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { APP_TIMEZONE } from "@/lib/date-utils";


function formatHistoryDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const monthDay = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  });
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
  return `${monthDay} · ${time} ET`;
}

interface GameRowProps {
  game: SafeGameCore;
  showPin?: boolean;
  variant?: "home" | "history";
}

export const GameRow = memo(function GameRow({ game, showPin = true, variant = "home" }: GameRowProps) {
  const isHistory = variant === "history";
  const router = useRouter();
  const { isRevealed } = useReveal();
  const gate = useSpoilerGate(game.id);

  const pinned = usePinnedGames((s) => s.isPinned)(game.id);
  const pinnedCount = usePinnedGames((s) => s.pinnedIds.size);
  const togglePin = usePinnedGames((s) => s.togglePin);

  const freshness = useDataFreshness(game);

  const read = isRevealed(game.id);
  const final = isFinal(game.status, game);
  const live = isLive(game.status, game);
  const pregame = isPregame(game.status, game);

  const canToggle = gate?.canToggle ?? false;
  const scoresVisible = gate?.revealed ?? false;
  const hasNewData = gate?.hasUpdate ?? false;

  // ── Score flash animation ─────────────────────────────────────
  const prevAwayRef = useRef(gate?.awayScore);
  const prevHomeRef = useRef(gate?.homeScore);
  const [scoreFlash, setScoreFlash] = useState(false);

  useEffect(() => {
    const pA = prevAwayRef.current, pH = prevHomeRef.current;
    prevAwayRef.current = gate?.awayScore;
    prevHomeRef.current = gate?.homeScore;
    if (scoresVisible && pA != null && pH != null &&
        gate?.awayScore != null && gate?.homeScore != null &&
        (pA !== gate.awayScore || pH !== gate.homeScore)) {
      setScoreFlash(true);
    }
  }, [gate?.awayScore, gate?.homeScore, scoresVisible]);

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
    router.push(`/game/${game.id}`);
  };

  const handleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!gate) return;
    if (read && hasNewData) {
      gate.acceptUpdate();
    } else {
      gate.reveal();
    }
  };

  // ── Live clock string (used in score zone) ──────────────────
  const liveTimeStr = (() => {
    if (!live) return "";
    const showClock = scoresVisible;
    const snapshot = useReveal.getState().getSnapshot(game.id);
    if (gate?.frozen && snapshot?.periodLabel) {
      const snapClock = snapshot.clock && snapshot.clock !== snapshot.periodLabel ? snapshot.clock : "";
      return `${snapshot.periodLabel}${snapClock ? ` ${snapClock}` : ""}`;
    }
    if (!showClock) return "";
    const clock = game.gameClock && game.gameClock !== game.currentPeriodLabel ? game.gameClock : "";
    return (game.currentPeriodLabel || clock)
      ? `${game.currentPeriodLabel ?? ""}${clock ? ` ${clock}` : ""}`
      : "";
  })();

  // ── Status indicator ──────────────────────────────────────────

  const statusContent = (() => {
    if (isHistory) {
      return <span className="text-neutral-600 text-xs">Final</span>;
    }

    if (live) {
      if (hasNewData) {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); gate?.acceptUpdate(); }}
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
            onClick={(e) => { e.stopPropagation(); gate?.acceptUpdate(); }}
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
      return <span className="text-neutral-500 text-xs">{formatTimeET(game.gameDate)}</span>;
    }

    return null;
  })();

  // ── Score zone ────────────────────────────────────────────────

  const scoreZone = (() => {
    const hasGateScores = gate?.homeScore != null && gate?.awayScore != null;
    if (pregame || !hasGateScores && !canToggle) return null;

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

    if (live) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasNewData) gate?.acceptUpdate();
          }}
          className={cn(
            "shrink-0 pl-3 min-w-[96px] min-h-[44px] flex items-center justify-end text-right gap-2",
            scoreFlash && "score-flash",
          )}
        >
          {liveTimeStr && <span className="text-neutral-500 text-[11px] font-normal whitespace-nowrap">{liveTimeStr}</span>}
          <span className="text-lg font-bold tabular-nums text-neutral-200">{gate?.awayScore} <span className="text-neutral-600">&ndash;</span> {gate?.homeScore}</span>
        </button>
      );
    }

    return (
      <span className={cn(
        "shrink-0 text-lg font-bold tabular-nums text-neutral-200 pl-3 text-right min-w-[96px]",
        scoreFlash && "score-flash",
      )}>
        {gate?.awayScore} <span className="text-neutral-600">&ndash;</span> {gate?.homeScore}
      </span>
    );
  })();

  return (
    <div
      data-testid="game-row"
      onClick={handleNavigate}
      className={cn(
        "flex items-center min-h-[52px] px-4 py-3 rounded-[var(--ds-radius-game-card)] bg-neutral-800/20 border border-neutral-800/40 transition select-none",
        !isHistory && read && final && "opacity-70",
        live && "border-l-2 border-l-green-400",
        "cursor-pointer hover:bg-neutral-800/30 active:bg-neutral-800/40",
      )}
    >
      {/* Left: league + pin + status */}
      <div className="shrink-0 w-[88px] flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1">
          <LeagueBadge league={game.leagueCode} />
          {showPin && (pinned || pinnedCount < 10) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePin(game.id, { awayTeamAbbr: game.awayTeamAbbr ?? "AWY", homeTeamAbbr: game.homeTeamAbbr ?? "HME" });
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
        <FreshnessBadge staleness={freshness.staleness} ageLabel={freshness.ageLabel} isFinal={final} />
      </div>

      {/* Center: matchup — abbreviations on small screens, display names on sm+ */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 truncate">
        <span
          className="text-[15px] font-semibold truncate"
          style={{ color: resolveTeamColor(game.awayTeamColorLight, game.awayTeamColorDark) }}
        >
          <span className="sm:hidden">{game.awayTeamAbbr ?? cardDisplayName(game.awayTeam, game.leagueCode, game.awayTeamAbbr)}</span>
          <span className="hidden sm:inline">{cardDisplayName(game.awayTeam, game.leagueCode, game.awayTeamAbbr)}</span>
        </span>
        <span className="text-neutral-600 text-xs font-medium shrink-0">@</span>
        <span
          className="text-[15px] font-semibold truncate"
          style={{ color: resolveTeamColor(game.homeTeamColorLight, game.homeTeamColorDark) }}
        >
          <span className="sm:hidden">{game.homeTeamAbbr ?? cardDisplayName(game.homeTeam, game.leagueCode, game.homeTeamAbbr)}</span>
          <span className="hidden sm:inline">{cardDisplayName(game.homeTeam, game.leagueCode, game.homeTeamAbbr)}</span>
        </span>
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
