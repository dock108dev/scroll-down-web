"use client";

import { useCallback } from "react";
import type { GameCore } from "@/stores/game-data";
import { useSettings } from "@/stores/settings";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { GameRow } from "./GameRow";

interface TimelineSectionProps {
  title: string;
  games: GameCore[];
  stickyTop?: string;
}

export function TimelineSection({ title, games, stickyTop }: TimelineSectionProps) {
  const homeExpandedSections = useSettings((s) => s.homeExpandedSections);
  const setHomeExpandedSections = useSettings((s) => s.setHomeExpandedSections);

  const expanded = homeExpandedSections.includes(title);

  const handleToggle = useCallback(() => {
    const next = expanded
      ? homeExpandedSections.filter((s) => s !== title)
      : [...homeExpandedSections, title];
    setHomeExpandedSections(next);
  }, [expanded, homeExpandedSections, setHomeExpandedSections, title]);

  if (games.length === 0) return null;

  return (
    <div>
      <SectionHeader
        title={title}
        expanded={expanded}
        onToggle={handleToggle}
        count={games.length}
        stickyTop={stickyTop}
      />
      {expanded &&
        games.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
    </div>
  );
}
