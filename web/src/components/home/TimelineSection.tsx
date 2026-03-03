"use client";

import type { GameCore } from "@/stores/game-data";
import { GameRow } from "./GameRow";

interface TimelineSectionProps {
  title: string;
  games: GameCore[];
}

export function TimelineSection({ title, games }: TimelineSectionProps) {
  if (games.length === 0) return null;

  return (
    <div>
      <div
        className="sticky z-20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-950 border-b border-neutral-800"
        style={{ top: "var(--header-h)" }}
      >
        {title} ({games.length})
      </div>
      {games.map((game) => (
        <GameRow key={game.id} game={game} />
      ))}
    </div>
  );
}
