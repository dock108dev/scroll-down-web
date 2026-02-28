"use client";

import type { GameSummary } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { GameCard } from "./GameCard";
import { useCallback } from "react";

interface GameSectionProps {
  title: string;
  games: GameSummary[];
  actions?: React.ReactNode;
}

export function GameSection({
  title,
  games,
  actions,
}: GameSectionProps) {
  const homeExpandedSections = useSettings((s) => s.homeExpandedSections);
  const setHomeExpandedSections = useSettings(
    (s) => s.setHomeExpandedSections,
  );

  const DEFAULT_EXPANDED = ["Today", "Yesterday"];

  // If user hasn't toggled any sections yet (empty list), fall back to defaults.
  const usingDefaults = homeExpandedSections.length === 0;
  const effective = usingDefaults ? DEFAULT_EXPANDED : homeExpandedSections;
  const expanded = effective.includes(title);

  const handleToggle = useCallback(() => {
    const base = usingDefaults ? DEFAULT_EXPANDED : homeExpandedSections;
    const next = expanded
      ? base.filter((s) => s !== title)
      : [...base, title];
    setHomeExpandedSections(next);
  }, [expanded, usingDefaults, homeExpandedSections, setHomeExpandedSections, title]);

  if (games.length === 0) return null;

  return (
    <div>
      <div className="flex items-center">
        <div className="flex-1">
          <SectionHeader
            title={title}
            expanded={expanded}
            onToggle={handleToggle}
            count={games.length}
          />
        </div>
        {actions && (
          <div className="pr-4 flex items-center gap-2">{actions}</div>
        )}
      </div>
      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 auto-rows-fr gap-3 md:gap-2 px-4 pb-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
