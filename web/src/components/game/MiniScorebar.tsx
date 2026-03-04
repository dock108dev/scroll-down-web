"use client";

import type { Game } from "@/lib/types";
import type { GameCore } from "@/stores/game-data";
import { isLive, isFinal, isPregame } from "@/lib/types";
import { useScoreDisplay } from "@/hooks/useScoreDisplay";
import { useReveal } from "@/stores/reveal";
import { useSettings } from "@/stores/settings";
import { pickSnapshot } from "@/lib/score-display";
import { cn } from "@/lib/utils";

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

  const awayColor = game.awayTeamColorDark || "#888";
  const homeColor = game.homeTeamColorDark || "#888";

  const handleReveal = () => reveal(game.id, pickSnapshot(game as GameCore));
  const handleHide = () => hide(game.id);

  // Status label
  let statusLabel: string;
  if (pregame) {
    statusLabel = "Upcoming";
  } else if (!showScore) {
    statusLabel = "vs";
  } else if (live && (game.currentPeriodLabel || game.gameClock)) {
    const parts = [game.currentPeriodLabel, game.gameClock].filter(Boolean);
    statusLabel = parts.join(" ");
  } else if (final) {
    statusLabel = "Final";
  } else {
    statusLabel = "";
  }

  const showToggle = canToggle && scoreRevealMode !== "always" && !pregame && !live;

  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
      style={{
        gridTemplateRows: visible ? "1fr" : "0fr",
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="overflow-hidden">
        <div className="border-b border-neutral-800 px-4 py-1.5">
          <div className="flex items-center gap-4">
            {/* Left: two team rows */}
            <div className="flex flex-col gap-0.5 min-w-0">
              {/* Away row */}
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold w-10 tracking-tight"
                  style={{ color: awayColor }}
                >
                  {game.awayTeamAbbr ?? game.awayTeam}
                </span>
                {showScore && (
                  <span className="text-xs font-bold tabular-nums text-neutral-100">
                    {display?.awayScore}
                  </span>
                )}
              </div>
              {/* Home row */}
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold w-10 tracking-tight"
                  style={{ color: homeColor }}
                >
                  {game.homeTeamAbbr ?? game.homeTeam}
                </span>
                {showScore && (
                  <span className="text-xs font-bold tabular-nums text-neutral-100">
                    {display?.homeScore}
                  </span>
                )}
              </div>
            </div>

            {/* Center: status */}
            <div className="flex-1 text-center">
              <span
                className={cn(
                  "text-xs font-medium",
                  !showScore && !pregame
                    ? "text-neutral-600"
                    : "text-neutral-500",
                )}
              >
                {statusLabel}
              </span>
            </div>

            {/* Right: toggle */}
            {showToggle && (
              <button
                onClick={revealed ? handleHide : handleReveal}
                className={cn(
                  "shrink-0 text-xs font-medium transition-colors",
                  revealed
                    ? "text-neutral-500 hover:text-neutral-400"
                    : "text-blue-400 hover:text-blue-300",
                )}
              >
                {revealed ? "Hide" : "Reveal"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
