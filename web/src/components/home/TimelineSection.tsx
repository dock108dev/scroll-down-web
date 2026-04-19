"use client";

import { useCallback, useMemo, useState, Fragment } from "react";
import type { GameCore } from "@/stores/game-data";
import { useSettings } from "@/stores/settings";
import { useReveal } from "@/stores/reveal";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { GameRow } from "./GameRow";
import { NativeAdCard } from "@/components/ads/NativeAdCard";
import { isFinal, isLive } from "@/lib/types";
import { pickSnapshot } from "@/lib/score-display";
import { ADS } from "@/lib/config";

interface TimelineSectionProps {
  title: string;
  games: GameCore[];
  stickyTop?: string;
  pinnedIds?: Set<number>;
}

export function TimelineSection({ title, games, stickyTop, pinnedIds }: TimelineSectionProps) {
  const homeExpandedSections = useSettings((s) => s.homeExpandedSections);
  const setHomeExpandedSections = useSettings((s) => s.setHomeExpandedSections);
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const followingLive = useSettings((s) => s.followingLive);

  const reveal = useReveal();

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

  // Games eligible for batch reveal (final or live with score data)
  const revealableGames = useMemo(
    () =>
      games.filter(
        (g) =>
          (isFinal(g.status, g) || isLive(g.status, g)) &&
          g.homeScore != null &&
          g.awayScore != null,
      ),
    [games],
  );

  const unrevealedRevealable = useMemo(
    () => revealableGames.filter((g) => !reveal.isRevealed(g.id)),
    [revealableGames, reveal],
  );

  const unrevealedAll = useMemo(
    () => games.filter((g) => !reveal.isRevealed(g.id)),
    [games, reveal],
  );

  const showBatchActions =
    expanded && scoreRevealMode !== "always" && !followingLive;

  const handleRevealAll = useCallback(() => {
    const entries = unrevealedRevealable.map((g) => ({
      gameId: g.id,
      snapshot: pickSnapshot(g),
    }));
    reveal.revealBatch(entries);
  }, [unrevealedRevealable, reveal]);

  const handleMarkAllRead = useCallback(() => {
    reveal.markReadBatch(unrevealedAll.map((g) => g.id));
  }, [unrevealedAll, reveal]);

  if (games.length === 0) return null;

  const batchActions =
    showBatchActions && (unrevealedRevealable.length > 0 || unrevealedAll.length > 0) ? (
      <>
        {unrevealedRevealable.length > 0 && (
          <button
            data-testid={`reveal-all-${title.toLowerCase()}`}
            onClick={handleRevealAll}
            aria-label={`Reveal all scores in ${title}`}
            className="rounded-full bg-blue-600/20 px-2.5 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-600/30 transition min-h-[32px]"
          >
            Reveal All
          </button>
        )}
        {unrevealedAll.length > 0 && (
          <button
            data-testid={`mark-all-read-${title.toLowerCase()}`}
            onClick={handleMarkAllRead}
            aria-label={`Mark all ${title} games as read`}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition min-h-[32px]"
          >
            Mark read
          </button>
        )}
      </>
    ) : null;

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
          actions={batchActions}
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
              <div className="max-h-[40vh] overflow-y-auto overscroll-contain space-y-1.5 px-3 py-1.5">
                {pinned.map((game) => (
                  <GameRow key={game.id} game={game} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* All games (pinned appear here too, in their normal position) */}
      {expanded && (
        <div className="space-y-1.5 px-3 py-1.5">
          {games.map((game, index) => (
            <Fragment key={game.id}>
              <GameRow game={game} />
              {(index + 1) % ADS.NATIVE_AD_INTERVAL === 0 && (
                <NativeAdCard slotIndex={Math.floor((index + 1) / ADS.NATIVE_AD_INTERVAL)} />
              )}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
