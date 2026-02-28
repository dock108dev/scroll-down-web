"use client";

import { useReadState } from "@/stores/read-state";
import { useSettings } from "@/stores/settings";
import { isLive, isFinal } from "@/lib/types";
import type { GameStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScoreRevealProps {
  gameId: number;
  status: GameStatus;
  score: number | undefined;
  className?: string;
}

export function ScoreReveal({
  gameId,
  status,
  score,
  className,
}: ScoreRevealProps) {
  const { isRead, markRead } = useReadState();
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);

  const read = isRead(gameId);
  const showScore =
    scoreRevealMode === "always" || read || isLive(status);

  const handleClick = () => {
    if (!showScore && isFinal(status)) {
      markRead(gameId, status);
    }
  };

  return (
    <span
      onClick={handleClick}
      className={cn(
        "tabular-nums",
        !showScore && "blur-md cursor-pointer select-none",
        className,
      )}
    >
      {score ?? "-"}
    </span>
  );
}
