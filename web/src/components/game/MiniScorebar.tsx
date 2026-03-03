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
}

export function MiniScorebar({ game }: MiniScorebarProps) {
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

  // Center label
  let centerLabel: string;
  if (pregame) {
    centerLabel = "Upcoming";
  } else if (!showScore) {
    centerLabel = "vs";
  } else if (live && (game.currentPeriodLabel || game.gameClock)) {
    const parts = [game.currentPeriodLabel, game.gameClock].filter(Boolean);
    centerLabel = parts.join(" ");
  } else if (final) {
    centerLabel = "Final";
  } else {
    centerLabel = "";
  }

  return (
    <div
      className="sticky z-25 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur px-4 py-1.5"
      style={{ top: "calc(var(--header-h) + 41px)" }}
    >
      <div className="flex items-center justify-between">
        {/* Left: away team */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm font-bold tracking-tight"
            style={{ color: awayColor }}
          >
            {game.awayTeamAbbr ?? game.awayTeam}
          </span>
          {showScore && (
            <span className="text-sm font-bold tabular-nums text-neutral-100">
              {display?.awayScore}
            </span>
          )}
        </div>

        {/* Center: status */}
        <span
          className={cn(
            "text-xs font-medium",
            !showScore && !pregame ? "text-neutral-600" : "text-neutral-500",
          )}
        >
          {centerLabel}
        </span>

        {/* Right: home team + toggle */}
        <div className="flex items-center gap-2 min-w-0">
          {showScore && (
            <span className="text-sm font-bold tabular-nums text-neutral-100">
              {display?.homeScore}
            </span>
          )}
          <span
            className="text-sm font-bold tracking-tight"
            style={{ color: homeColor }}
          >
            {game.homeTeamAbbr ?? game.homeTeam}
          </span>

          {/* Toggle button (hide mode only, not pregame) */}
          {canToggle && scoreRevealMode !== "always" && !pregame && (
            <button
              onClick={revealed ? handleHide : handleReveal}
              className={cn(
                "ml-2 text-xs font-medium transition-colors",
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
  );
}
