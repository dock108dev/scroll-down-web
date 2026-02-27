"use client";

import type { GameSummary } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { GameCard } from "./GameCard";
import { useCallback } from "react";

interface GameSectionProps {
  title: string;
  games: GameSummary[];
  defaultExpanded?: boolean;
  actions?: React.ReactNode;
}

export function GameSection({
  title,
  games,
  defaultExpanded = true,
  actions,
}: GameSectionProps) {
  const homeExpandedSections = useSettings((s) => s.homeExpandedSections);
  const setHomeExpandedSections = useSettings(
    (s) => s.setHomeExpandedSections,
  );

  // If the section is in the persisted list, it is expanded.
  // If the list is empty (fresh user), fall back to defaultExpanded.
  const expanded =
    homeExpandedSections.length > 0
      ? homeExpandedSections.includes(title)
      : defaultExpanded;

  const handleToggle = useCallback(() => {
    let next: string[];
    if (homeExpandedSections.length === 0) {
      // First interaction: initialize from defaults, then toggle
      const defaults = ["Today", "Yesterday"];
      if (expanded) {
        next = defaults.filter((s) => s !== title);
      } else {
        next = [...defaults, title];
      }
    } else if (expanded) {
      next = homeExpandedSections.filter((s) => s !== title);
    } else {
      next = [...homeExpandedSections, title];
    }
    setHomeExpandedSections(next);
  }, [expanded, homeExpandedSections, setHomeExpandedSections, title]);

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
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-2 px-4 pb-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
