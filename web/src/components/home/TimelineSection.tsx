"use client";

import { useCallback, useMemo, useState } from "react";
import type { GameCore } from "@/stores/game-data";
import { useSettings } from "@/stores/settings";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { GameRow } from "./GameRow";

interface TimelineSectionProps {
  title: string;
  games: GameCore[];
  stickyTop?: string;
  pinnedIds?: Set<number>;
}

export function TimelineSection({ title, games, stickyTop, pinnedIds }: TimelineSectionProps) {
  const homeExpandedSections = useSettings((s) => s.homeExpandedSections);
  const setHomeExpandedSections = useSettings((s) => s.setHomeExpandedSections);

  const expanded = homeExpandedSections.includes(title);

  const handleToggle = useCallback(() => {
    const next = expanded
      ? homeExpandedSections.filter((s) => s !== title)
      : [...homeExpandedSections, title];
    setHomeExpandedSections(next);
  }, [expanded, homeExpandedSections, setHomeExpandedSections, title]);

  const [pinnedOpen, setPinnedOpen] = useState(true);

  // Collect pinned games for sticky subsection
  const pinned = useMemo(() => {
    if (!pinnedIds || pinnedIds.size === 0) return [] as GameCore[];
    return games.filter((g) => pinnedIds.has(g.id));
  }, [games, pinnedIds]);

  if (games.length === 0) return null;

  return (
    <div>
      {/* Single sticky container: section header + pinned bar together */}
      <div
        className="sticky z-20 bg-neutral-950"
        style={{ top: stickyTop }}
      >
        <SectionHeader
          title={title}
          expanded={expanded}
          onToggle={handleToggle}
          count={games.length}
          sticky={false}
        />

        {/* Pinned subsection — inside the same sticky container */}
        {expanded && pinned.length > 0 && (
          <div className="bg-neutral-950 border-b border-neutral-800">
            <button
              onClick={() => setPinnedOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-blue-400 hover:text-blue-300 transition"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.09 6.26L21 9.27l-5 4.87L17.18 22 12 18.56 6.82 22 8 14.14l-5-4.87 6.91-1.01L12 2z" />
              </svg>
              Pinned
              <span className="bg-blue-400/15 rounded-full px-1.5 py-0.5 text-[10px]">
                {pinned.length}
              </span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`ml-auto transition-transform ${pinnedOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {pinnedOpen && (
              <div className="max-h-[40vh] overflow-y-auto overscroll-contain">
                {pinned.map((game) => (
                  <GameRow key={game.id} game={game} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* All games (pinned appear here too, in their normal position) */}
      {expanded &&
        games.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
    </div>
  );
}
