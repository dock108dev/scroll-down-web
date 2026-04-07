"use client";

import { useState } from "react";
import type { Game } from "@/lib/types";
import type { GameCore } from "@/stores/game-data";
import { isPregame } from "@/lib/types";
import { useReveal } from "@/stores/reveal";
import { useScoreDisplay } from "@/hooks/useScoreDisplay";
import { usePinnedGames } from "@/stores/pinned-games";
import { SCORE_HIDE_LIMITS, useSettings } from "@/stores/settings";
import { pickSnapshot } from "@/lib/score-display";
import { cn, formatDate, formatTimeET, teamColorStyle } from "@/lib/utils";

interface GameHeaderProps {
  game: Game | GameCore;
}

export function GameHeader({ game }: GameHeaderProps) {
  const { reveal, hide, isRevealed, acceptUpdate } = useReveal();
  const display = useScoreDisplay(game.id);
  const [showHideTeamPicker, setShowHideTeamPicker] = useState(false);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const setScoreRevealMode = useSettings((s) => s.setScoreRevealMode);
  const scoreHideTeams = useSettings((s) => s.scoreHideTeams);
  const addScoreHideTeam = useSettings((s) => s.addScoreHideTeam);

  const pinned = usePinnedGames((s) => s.isPinned)(game.id);
  const pinnedCount = usePinnedGames((s) => s.pinnedIds.size);
  const togglePin = usePinnedGames((s) => s.togglePin);

  const read = isRevealed(game.id);
  const pregame = isPregame(game.status, game);

  const hasScoreData = game.homeScore != null && game.awayScore != null;
  const showScore = display?.visible ?? false;
  const hasScoreUpdate = display?.hasUpdate ?? false;
  const statusCategory = display?.statusCategory ?? "other";
  const hiddenSet = new Set(scoreHideTeams.map((v) => v.trim().toLowerCase()));
  const awayAlreadyHidden =
    hiddenSet.has(game.awayTeam.trim().toLowerCase()) ||
    (!!game.awayTeamAbbr && hiddenSet.has(game.awayTeamAbbr.trim().toLowerCase()));
  const homeAlreadyHidden =
    hiddenSet.has(game.homeTeam.trim().toLowerCase()) ||
    (!!game.homeTeamAbbr && hiddenSet.has(game.homeTeamAbbr.trim().toLowerCase()));
  const canHideAnyTeam = !awayAlreadyHidden || !homeAlreadyHidden;
  const teamsAtLimit = scoreHideTeams.length >= SCORE_HIDE_LIMITS.TEAMS;
  const openHidePickerDisabled = !canHideAnyTeam || teamsAtLimit;

  const handleScoreToggle = () => {
    if (!hasScoreData) return;
    // Only use acceptUpdate when already revealed and there's a pending update.
    // For first-time reveals, always use reveal() so the game is added to
    // revealedIds (acceptUpdate only updates the snapshot).
    if (read && hasScoreUpdate) {
      acceptUpdate(game.id, pickSnapshot(game as GameCore));
      return;
    }
    if (read) hide(game.id);
    else reveal(game.id, pickSnapshot(game as GameCore));
  };

  const awayStyle = teamColorStyle(game.awayTeamColorLight, game.awayTeamColorDark);
  const homeStyle = teamColorStyle(game.homeTeamColorLight, game.homeTeamColorDark);

  const hideAwayTeam = () => addScoreHideTeam(game.awayTeam);
  const hideHomeTeam = () => addScoreHideTeam(game.homeTeam);
  const hideBothTeams = () => {
    if (scoreHideTeams.length + (awayAlreadyHidden ? 0 : 1) + (homeAlreadyHidden ? 0 : 1) > SCORE_HIDE_LIMITS.TEAMS) {
      return;
    }
    addScoreHideTeam(game.awayTeam);
    addScoreHideTeam(game.homeTeam);
  };

  return (
    <div data-testid="game-header" className="px-4 pt-6 pb-4">
      <div className="rounded-xl bg-neutral-800/30 border border-neutral-800/60 px-5 py-5">
        {/* League + date + status */}
        <div className="flex items-center justify-between mb-5">
          <span className="inline-flex items-center gap-2">
            <span className="text-xs uppercase font-medium text-neutral-500 tracking-wide">
              {game.leagueCode.toUpperCase()} &middot; {formatDate(game.gameDate)} &middot; {formatTimeET(game.gameDate)}
            </span>
            {(pinned || pinnedCount < 10) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(game.id, { awayTeamAbbr: game.awayTeamAbbr ?? "AWY", homeTeamAbbr: game.homeTeamAbbr ?? "HME" });
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
          <div className="flex items-center gap-2">
            {canHideAnyTeam && (
              <button
                disabled={openHidePickerDisabled}
                onClick={() => {
                  // Team hide lists affect score display only in blacklist mode.
                  // Switch mode automatically so this action has immediate effect.
                  if (scoreRevealMode !== "blacklist") {
                    setScoreRevealMode("blacklist");
                    setShowHideTeamPicker(true);
                    return;
                  }
                  setShowHideTeamPicker((v) => !v);
                }}
                className="p-1 rounded transition-colors text-neutral-600 hover:text-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed"
                title={teamsAtLimit ? "Team hide limit reached" : "Hide team"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            )}
            {statusCategory === "live" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="text-green-400">LIVE</span>
                {(game.currentPeriodLabel || game.gameClock) && (
                  <span className="text-neutral-500 font-normal">
                    {game.currentPeriodLabel ?? ""}{game.gameClock && game.gameClock !== game.currentPeriodLabel ? ` ${game.gameClock}` : ""}
                  </span>
                )}
              </span>
            )}
            {statusCategory === "live-updated" && (
              <button
                onClick={handleScoreToggle}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-400/10 hover:bg-amber-400/20 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                </span>
                <span className="text-amber-400">LIVE Update</span>
              </button>
            )}
            {statusCategory === "final" && (
              <span className="text-xs text-neutral-500 uppercase font-medium">Final</span>
            )}
            {statusCategory === "pregame" && (
              <span className="text-xs text-neutral-500 uppercase font-medium">Upcoming</span>
            )}
          </div>
        </div>

        {showHideTeamPicker && canHideAnyTeam && (
          <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-3">
            <p className="text-xs text-neutral-500 mb-2">
              Pick team to hide in selective score mode
            </p>
            {teamsAtLimit && (
              <p className="text-xs text-neutral-600 mb-2">
                Team limit reached ({scoreHideTeams.length}/{SCORE_HIDE_LIMITS.TEAMS}).
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {!awayAlreadyHidden ? (
                <button
                  disabled={teamsAtLimit}
                  onClick={hideAwayTeam}
                  className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {game.awayTeam}
                </button>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-500">
                  {game.awayTeam} hidden
                </span>
              )}
              {!homeAlreadyHidden ? (
                <button
                  disabled={teamsAtLimit}
                  onClick={hideHomeTeam}
                  className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {game.homeTeam}
                </button>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-500">
                  {game.homeTeam} hidden
                </span>
              )}
              {!awayAlreadyHidden && !homeAlreadyHidden && (
                <button
                  disabled={scoreHideTeams.length + 2 > SCORE_HIDE_LIMITS.TEAMS}
                  onClick={hideBothTeams}
                  className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Hide both
                </button>
              )}
            </div>
          </div>
        )}

        {/* Away (left) @ Home (right) — team colors as text */}
        <div className="flex items-center justify-between gap-4">
          {/* Away team */}
          <div className="flex-1 text-center">
            <div
              className="text-3xl font-extrabold tracking-tight"
              style={awayStyle}
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
                {hasScoreUpdate ? (
                  <p className="text-xs text-amber-400 mt-1 font-medium hover:text-amber-300 transition-colors">
                    Update
                  </p>
                ) : display?.canToggle ? (
                  <p className="text-xs text-neutral-700 mt-1 hover:text-neutral-500 transition-colors">
                    Hide score
                  </p>
                ) : null}
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
                    Click to reveal
                  </p>
                )}
              </>
            )}
          </div>

          {/* Home team */}
          <div className="flex-1 text-center">
            <div
              className="text-3xl font-extrabold tracking-tight"
              style={homeStyle}
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
