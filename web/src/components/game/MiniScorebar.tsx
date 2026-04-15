"use client";

import type { Game } from "@/lib/types";
import type { SafeGameCore } from "@/stores/game-data";
import { isPregame } from "@/lib/types";
import { useSpoilerGate } from "@/hooks/useSpoilerGate";
import { useSettings } from "@/stores/settings";
import { cn, formatTimeET, resolveTeamColor, teamColorStyle } from "@/lib/utils";

interface MiniScorebarProps {
  game: Game | SafeGameCore;
  visible: boolean;
}

export function MiniScorebar({ game, visible }: MiniScorebarProps) {
  const gate = useSpoilerGate(game.id);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);

  const pregame = isPregame(game.status, game);
  const showScore = gate?.revealed ?? false;
  const statusCategory = gate?.statusCategory ?? "other";

  const awayColor = resolveTeamColor(game.awayTeamColorLight, game.awayTeamColorDark, "#a3a3a3");
  const homeColor = resolveTeamColor(game.homeTeamColorLight, game.homeTeamColorDark, "#a3a3a3");
  const awayTextStyle = teamColorStyle(game.awayTeamColorLight, game.awayTeamColorDark, "#a3a3a3");
  const homeTextStyle = teamColorStyle(game.homeTeamColorLight, game.homeTeamColorDark, "#a3a3a3");

  const showToggle = gate?.canToggle && scoreRevealMode !== "always" && !pregame;

  const awayNum = gate?.awayScore != null ? Number(gate.awayScore) : 0;
  const homeNum = gate?.homeScore != null ? Number(gate.homeScore) : 0;
  const awayWinning = showScore && awayNum > homeNum;
  const homeWinning = showScore && homeNum > awayNum;

  return (
    <div
      data-testid="mini-scorebar"
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
                  style={awayWinning ? awayTextStyle : undefined}
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
                    {gate?.awayScore}
                  </span>
                )}
              </div>

              {/* Separator */}
              <span className="text-neutral-700 text-xs font-medium shrink-0">
                {pregame || (!showScore && statusCategory !== "live" && statusCategory !== "live-updated") ? "@" : "\u2014"}
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
                    {gate?.homeScore}
                  </span>
                )}
                <span
                  className={cn(
                    "text-sm font-bold tracking-tight",
                    homeWinning ? "text-neutral-50" : "text-neutral-400",
                  )}
                  style={homeWinning ? homeTextStyle : undefined}
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
                  {formatTimeET(game.gameDate)}
                </span>
              )}

              {/* Live: period + clock + indicator */}
              {statusCategory === "live" && (
                <>
                  {(game.currentPeriodLabel || game.gameClock) && (
                    <span className="text-xs font-medium text-neutral-300 tabular-nums">
                      {game.currentPeriodLabel ?? ""}
                      {game.gameClock && game.gameClock !== game.currentPeriodLabel ? ` \u00B7 ${game.gameClock}` : ""}
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

              {/* Pending update (live or game just went final) */}
              {statusCategory === "live-updated" && (
                <button
                  onClick={() => gate?.acceptUpdate()}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                  </span>
                  LIVE Update
                </button>
              )}

              {/* Final label (only when no pending update) */}
              {statusCategory === "final" && showScore && (
                <span className="text-xs font-medium text-neutral-500 uppercase">
                  Final
                </span>
              )}

              {/* Reveal / Hide toggle */}
              {showToggle && (
                <button
                  onClick={gate?.revealed ? () => gate.hide() : () => gate?.reveal()}
                  className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-full transition-colors",
                    gate?.revealed
                      ? "text-neutral-500 bg-neutral-800 hover:text-neutral-300"
                      : "text-blue-400 bg-blue-400/10 hover:bg-blue-400/20",
                  )}
                >
                  {gate?.revealed ? "Hide" : "Reveal"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
