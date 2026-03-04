"use client";

import type { Game } from "@/lib/types";
import type { GameCore } from "@/stores/game-data";
import { isLive, isFinal, isPregame } from "@/lib/types";
import { useScoreDisplay } from "@/hooks/useScoreDisplay";
import { useReveal } from "@/stores/reveal";
import { useSettings } from "@/stores/settings";
import { pickSnapshot } from "@/lib/score-display";
import { cn } from "@/lib/utils";

function formatStartTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }) + " ET";
}

interface MiniScorebarProps {
  game: Game | GameCore;
  visible: boolean;
}

export function MiniScorebar({ game, visible }: MiniScorebarProps) {
  const display = useScoreDisplay(game.id);
  const { reveal, hide, isRevealed } = useReveal();
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);

  const revealed = isRevealed(game.id);
  const live = isLive(game.status);
  const final = isFinal(game.status);
  const pregame = isPregame(game.status);
  const showScore = display?.visible ?? false;
  const canToggle = display?.canToggle ?? false;

  const awayColor = game.awayTeamColorDark || "#a3a3a3";
  const homeColor = game.homeTeamColorDark || "#a3a3a3";

  const handleReveal = () => reveal(game.id, pickSnapshot(game as GameCore));
  const handleHide = () => hide(game.id);

  const showToggle = canToggle && scoreRevealMode !== "always" && !pregame;

  const awayScore = display?.awayScore ?? 0;
  const homeScore = display?.homeScore ?? 0;
  const awayWinning = showScore && awayScore > homeScore;
  const homeWinning = showScore && homeScore > awayScore;

  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
      style={{
        gridTemplateRows: visible ? "1fr" : "0fr",
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="overflow-hidden">
        <div className="border-b border-neutral-800 px-4 py-2.5">
          <div className="flex items-center gap-4">
            {/* League badge */}
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 shrink-0">
              {game.leagueCode}
            </span>

            {/* Scoreboard */}
            <div className="flex items-center gap-3 flex-1 justify-center min-w-0">
              {/* Away team */}
              <div className="flex items-center gap-2">
                <span
                  className="w-1 h-5 rounded-full shrink-0"
                  style={{ backgroundColor: awayColor }}
                />
                <span
                  className={cn(
                    "text-sm font-bold tracking-tight",
                    awayWinning ? "text-neutral-50" : "text-neutral-400",
                  )}
                  style={awayWinning ? { color: awayColor } : undefined}
                >
                  {game.awayTeamAbbr ?? game.awayTeam}
                </span>
                {showScore && (
                  <span
                    className={cn(
                      "text-xl font-extrabold tabular-nums",
                      awayWinning ? "text-neutral-50" : "text-neutral-500",
                    )}
                  >
                    {awayScore}
                  </span>
                )}
              </div>

              {/* Separator */}
              <span className="text-neutral-700 text-xs font-medium shrink-0">
                {pregame || (!showScore && !live) ? "@" : "—"}
              </span>

              {/* Home team */}
              <div className="flex items-center gap-2">
                {showScore && (
                  <span
                    className={cn(
                      "text-xl font-extrabold tabular-nums",
                      homeWinning ? "text-neutral-50" : "text-neutral-500",
                    )}
                  >
                    {homeScore}
                  </span>
                )}
                <span
                  className={cn(
                    "text-sm font-bold tracking-tight",
                    homeWinning ? "text-neutral-50" : "text-neutral-400",
                  )}
                  style={homeWinning ? { color: homeColor } : undefined}
                >
                  {game.homeTeamAbbr ?? game.homeTeam}
                </span>
                <span
                  className="w-1 h-5 rounded-full shrink-0"
                  style={{ backgroundColor: homeColor }}
                />
              </div>
            </div>

            {/* Right: status + actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Pregame: start time */}
              {pregame && (
                <span className="text-xs text-neutral-400 tabular-nums">
                  {formatStartTime(game.gameDate)}
                </span>
              )}

              {/* Live: period + clock + indicator */}
              {live && (
                <>
                  {(game.currentPeriodLabel || game.gameClock) && (
                    <span className="text-xs font-medium text-neutral-300 tabular-nums">
                      {game.currentPeriodLabel ?? ""}
                      {game.gameClock ? ` · ${game.gameClock}` : ""}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                    </span>
                    <span className="text-[10px] font-bold text-green-400 uppercase">
                      Live
                    </span>
                  </span>
                </>
              )}

              {/* Final label */}
              {final && showScore && (
                <span className="text-xs font-medium text-neutral-500 uppercase">
                  Final
                </span>
              )}

              {/* Reveal / Hide toggle */}
              {showToggle && (
                <button
                  onClick={revealed ? handleHide : handleReveal}
                  className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-full transition-colors",
                    revealed
                      ? "text-neutral-500 bg-neutral-800 hover:text-neutral-300"
                      : "text-blue-400 bg-blue-400/10 hover:bg-blue-400/20",
                  )}
                >
                  {revealed ? "Hide" : "Reveal"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
