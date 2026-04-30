"use client";

import { memo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameCore } from "@/stores/game-data";
import { isLive, isFinal, isPregame, type GameStatus } from "@/lib/types";
import { useReveal } from "@/stores/reveal";
import type { RevealSnapshot } from "@/stores/reveal";
import { useScoreDisplay } from "@/hooks/useScoreDisplay";
import { usePinnedGames } from "@/stores/pinned-games";
import { cn, cardDisplayName, formatTimeET, resolveTeamColor } from "@/lib/utils";
import { LeagueBadge } from "@/components/fairbet/LeagueBadge";
import { APP_TIMEZONE } from "@/lib/date-utils";
import { pickSnapshot } from "@/lib/score-display";
import { useFreshnessLabel } from "@/hooks/useFreshnessLabel";
import { HOME_COPY } from "./copy";

interface GameRowProps {
  game: GameCore;
  showPin?: boolean;
  variant?: "home" | "history";
}

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

function formatSnapshotContext(snapshot: RevealSnapshot | undefined): string {
  if (!snapshot) return "";
  if (isFinal(snapshot.status as GameStatus)) return "Final";

  const periodLabel = snapshot.periodLabel ?? (snapshot.period ? `P${snapshot.period}` : "");
  const clock = snapshot.clock && snapshot.clock !== periodLabel
    ? snapshot.clock
    : "";

  if (periodLabel && clock) return `${periodLabel} ${clock}`;
  return periodLabel || clock;
}

export const GameRow = memo(function GameRow({ game, showPin = true, variant = "home" }: GameRowProps) {
  const isHistory = variant === "history";
  const router = useRouter();
  const { reveal, acceptUpdate, isRevealed } = useReveal();
  const snapshot = useReveal((s) => s.getSnapshot(game.id));
  const display = useScoreDisplay(game.id);

  const pinned = usePinnedGames((s) => s.isPinned)(game.id);
  const pinnedCount = usePinnedGames((s) => s.pinnedIds.size);
  const togglePin = usePinnedGames((s) => s.togglePin);

  const read = isRevealed(game.id);
  const final = isFinal(game.status, game);
  const live = isLive(game.status, game);
  const pregame = isPregame(game.status, game);

  const hasScoreData = game.homeScore != null && game.awayScore != null;
  const canToggle = display?.canToggle ?? false;
  const scoresVisible = display?.visible ?? false;
  const hasNewData = display?.hasUpdate ?? false;
  const freshness = useFreshnessLabel(game.id, live && !isHistory);

  // Three visual states for read/unread treatment
  const revealState: "unrevealed" | "revealed" | "updated" =
    !isHistory && canToggle
      ? read && hasNewData
        ? "updated"
        : read
        ? "revealed"
        : "unrevealed"
      : "revealed";

  // ── Score flash animation ─────────────────────────────────────
  // flashCount increments on each score change; key={flashCount} on the score
  // span forces a remount that naturally restarts the CSS animation.
  const prevAwayRef = useRef(display?.awayScore);
  const prevHomeRef = useRef(display?.homeScore);
  const [flashCount, setFlashCount] = useState(0);

  useEffect(() => {
    const pA = prevAwayRef.current, pH = prevHomeRef.current;
    prevAwayRef.current = display?.awayScore;
    prevHomeRef.current = display?.homeScore;
    if (scoresVisible && pA != null && pH != null &&
        display?.awayScore != null && display?.homeScore != null &&
        (pA !== display.awayScore || pH !== display.homeScore)) {
      const t = setTimeout(() => setFlashCount((c) => c + 1), 0);
      return () => clearTimeout(t);
    }
  }, [display?.awayScore, display?.homeScore, scoresVisible]);

  // ── Hide mode update pulse ──────────────────────────────────
  const prevHasNewRef = useRef(hasNewData);
  const [updatePulse, setUpdatePulse] = useState(false);

  useEffect(() => {
    const prev = prevHasNewRef.current;
    prevHasNewRef.current = hasNewData;
    if (!prev && hasNewData && canToggle && !scoresVisible) {
      const t = setTimeout(() => setUpdatePulse(true), 0);
      return () => clearTimeout(t);
    }
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
    // Always use reveal() for first-time reveals so the game is added to
    // revealedIds.  acceptUpdate() only updates the snapshot without marking
    // the game as revealed, which caused the button to appear broken for
    // live games (especially MLB where scores start at 0-0).
    if (read && hasNewData) {
      acceptUpdate(game.id, pickSnapshot(game));
    } else {
      reveal(game.id, pickSnapshot(game));
    }
  };

  // ── Game context string (used in score zone) ──────────────────
  const scoreContextStr = (() => {
    if (display?.frozen) return formatSnapshotContext(snapshot);
    if (!live || !scoresVisible) return "";

    const clock = game.gameClock && game.gameClock !== game.currentPeriodLabel ? game.gameClock : "";
    return (game.currentPeriodLabel || clock)
      ? `${game.currentPeriodLabel ?? ""}${clock ? ` ${clock}` : ""}`
      : "";
  })();

  const scoreTextClass = "shrink-0 whitespace-nowrap text-lg font-bold tabular-nums text-neutral-200 text-right";
  const scoreLaneClass = "shrink-0 min-w-[128px] min-h-[44px]";
  const showOpenGameHint = !isHistory && canToggle && !scoresVisible;

  // ── Status indicator ──────────────────────────────────────────

  const statusContent = (() => {
    // History variant: always show "Final", never show update indicators
    if (isHistory) {
      return <span className="text-neutral-600 text-xs">Final</span>;
    }

    if (live) {
      if (hasNewData) {
        return (
          <button
            data-testid="upd-badge"
            title="Update available"
            onClick={(e) => { e.stopPropagation(); acceptUpdate(game.id, pickSnapshot(game)); }}
            className="inline-flex max-w-full items-center gap-1 text-amber-400 font-semibold text-xs cursor-pointer hover:text-amber-300 transition"
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
        <span data-testid="live-badge" className="inline-flex items-center gap-1 text-green-400 font-semibold text-xs">
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
            data-testid="upd-badge"
            title="Update available"
            onClick={(e) => { e.stopPropagation(); acceptUpdate(game.id, pickSnapshot(game)); }}
            className="inline-flex max-w-full items-center gap-1 text-amber-400 font-semibold text-xs cursor-pointer hover:text-amber-300 transition"
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
    const hasDisplayScores = display?.homeScore != null && display?.awayScore != null;
    // Pregame: nothing to reveal yet.
    if (pregame) return null;
    // Always-visible mode with no score data: nothing to show.
    if (!canToggle && !hasScoreData && !hasDisplayScores) return null;

    // Always-visible mode: render score directly (no overlay needed)
    if (!canToggle) {
      if (live) {
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasNewData) acceptUpdate(game.id, pickSnapshot(game));
            }}
            className={cn(scoreLaneClass, "pl-3 flex items-center justify-end text-right gap-1.5")}
          >
            {scoreContextStr && <span className="text-neutral-500 text-[11px] font-normal whitespace-nowrap">{scoreContextStr}</span>}
            <span key={flashCount} data-testid="score-value" className={cn(scoreTextClass, flashCount > 0 && "score-flash")}>{display?.awayScore ?? game.awayScore} <span className="text-neutral-600">&ndash;</span> {display?.homeScore ?? game.homeScore}</span>
          </button>
        );
      }
      return (
        <span key={flashCount} data-testid="score-value" className={cn(
          scoreTextClass,
          "pl-3 min-w-[96px]",
          flashCount > 0 && "score-flash",
        )}>
          {display?.awayScore ?? game.awayScore} <span className="text-neutral-600">&ndash;</span> {display?.homeScore ?? game.homeScore}
        </span>
      );
    }

    // Reveal mode: blur overlay over the score. Only render the score when
    // the display layer says it's visible — otherwise the raw game score
    // leaks through the backdrop blur (the overlay is only ~75% opaque).
    const awayForDisplay = scoresVisible ? display?.awayScore : null;
    const homeForDisplay = scoresVisible ? display?.homeScore : null;
    const hasAnyScore = awayForDisplay != null && homeForDisplay != null;
    const scoreEl = hasAnyScore ? (
      <span key={flashCount} data-testid="score-value" className={cn(scoreTextClass, flashCount > 0 && "score-flash")}>
        {awayForDisplay} <span className="text-neutral-600">&ndash;</span> {homeForDisplay}
      </span>
    ) : null;

    return (
      <div className={cn("relative ml-3", scoreLaneClass)}>
        {/* Score always rendered beneath overlay */}
        {live ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasNewData) acceptUpdate(game.id, pickSnapshot(game));
            }}
            className="absolute inset-0 flex items-center justify-end gap-1.5 w-full"
            tabIndex={scoresVisible ? 0 : -1}
          >
            {scoreContextStr && <span className="text-neutral-500 text-[11px] font-normal whitespace-nowrap">{scoreContextStr}</span>}
            {scoreEl}
          </button>
        ) : (
          scoreEl ? (
            <div className="absolute inset-0 flex items-center justify-end gap-1.5">
              {scoreContextStr && <span className="text-neutral-500 text-[11px] font-normal whitespace-nowrap">{scoreContextStr}</span>}
              {scoreEl}
            </div>
          ) : null
        )}

        {/* Blur overlay — CSS transition fade-out on reveal */}
        <div
          data-testid="score-blur-overlay"
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-lg flex items-center justify-center",
            "transition-opacity duration-200 motion-reduce:transition-none",
            scoresVisible ? "opacity-0 pointer-events-none" : "opacity-100",
          )}
          style={{
            backdropFilter: "blur(8px)",
            background: "color-mix(in srgb, var(--ds-card-bg) 75%, transparent)",
          }}
        >
          <button
            data-testid="reveal-button"
            onClick={handleReveal}
            tabIndex={scoresVisible ? -1 : 0}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition min-h-[32px] border",
              "hover:opacity-90 active:opacity-80",
              updatePulse && "update-pulse",
            )}
            style={{
              color: "var(--ds-accent)",
              background: "var(--ds-accent-bg)",
              borderColor: "color-mix(in srgb, var(--ds-accent) 25%, transparent)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>{HOME_COPY.revealScore}</span>
          </button>
        </div>
      </div>
    );
  })();

  return (
    <div
      data-testid="game-row"
      data-reveal-state={revealState}
      onClick={handleNavigate}
      className={cn(
        "flex items-center min-h-[52px] px-4 py-3 rounded-[var(--ds-radius-game-card)] bg-neutral-800/20 border border-l-2 border-neutral-800/40 transition select-none",
        // Left border accent: stable 2px width, only color changes (no layout shift)
        revealState === "unrevealed" && !live && "border-l-blue-500",
        revealState === "updated" && "border-l-amber-400",
        live && revealState !== "updated" && "border-l-green-400",
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
        {freshness && (
          <span
            data-testid="freshness-label"
            className={cn(
              "text-[10px] leading-tight truncate",
              freshness.severity === "amber" && "text-amber-400",
              freshness.severity === "red" && "text-red-400",
            )}
          >
            {freshness.text}
          </span>
        )}
      </div>

      {/* Center: matchup — abbreviations on small screens, display names on sm+ */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <div className="min-w-0 flex items-center gap-1.5 truncate">
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
        {showOpenGameHint && (
          <span
            data-testid="open-game-hint"
            className="inline-flex min-w-0 items-center gap-1 text-[11px] leading-tight text-neutral-500"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
              aria-hidden="true"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
              <path d="M15 3h6v6" />
              <path d="m10 14 11-11" />
            </svg>
            <span className="truncate">{HOME_COPY.openGameHint}</span>
          </span>
        )}
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
