"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
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

  // Split pinned vs non-pinned
  const { pinned, rest } = useMemo(() => {
    if (!pinnedIds || pinnedIds.size === 0) return { pinned: [] as GameCore[], rest: games };
    const p: GameCore[] = [];
    const r: GameCore[] = [];
    for (const g of games) {
      if (pinnedIds.has(g.id)) p.push(g);
      else r.push(g);
    }
    return { pinned: p, rest: r };
  }, [games, pinnedIds]);

  // Measure section header height for pinned subsection offset
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (games.length === 0) return null;

  const pinnedStickyTop = stickyTop
    ? `calc(${stickyTop} + ${headerH}px)`
    : `${headerH}px`;

  return (
    <div>
      <div ref={headerRef}>
        <SectionHeader
          title={title}
          expanded={expanded}
          onToggle={handleToggle}
          count={games.length}
          stickyTop={stickyTop}
        />
      </div>
      {expanded && (
        <>
          {/* Pinned subsection — sticks below the section header */}
          {pinned.length > 0 && (
            <div
              className="sticky z-[15] bg-neutral-950 border-b border-neutral-800"
              style={{ top: pinnedStickyTop }}
            >
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
          {/* Remaining games */}
          {rest.map((game) => (
            <GameRow key={game.id} game={game} />
          ))}
        </>
      )}
    </div>
  );
}
