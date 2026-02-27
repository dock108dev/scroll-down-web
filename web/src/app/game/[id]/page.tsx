"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { isFinal, isLive, isPregame } from "@/lib/types";
import type { GameDetailResponse } from "@/lib/types";
import { GameHeader } from "@/components/game/GameHeader";
import { SectionNav } from "@/components/game/SectionNav";
import { FlowContainer } from "@/components/game/FlowContainer";
import { TimelineSection } from "@/components/game/TimelineSection";
import { StatsSection } from "@/components/game/StatsSection";
import { OddsSection } from "@/components/game/OddsSection";
import { WrapUpSection } from "@/components/game/WrapUpSection";
import { OverviewSection } from "@/components/game/OverviewSection";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useReadingPosition } from "@/stores/reading-position";
import { useReadState } from "@/stores/read-state";
import { useSettings } from "@/stores/settings";

// ─── Section definitions by status ─────────────────────────────
function getSections(data: GameDetailResponse): string[] {
  const status = data.game.status;

  if (isPregame(status)) {
    return ["Overview", "Odds"];
  }

  if (isLive(status)) {
    return ["Timeline", "Stats", "Odds"];
  }

  if (isFinal(status)) {
    return ["Flow", "Timeline", "Stats", "Odds", "Wrap-Up"];
  }

  // Fallback
  return ["Overview", "Odds"];
}

// ─── Default active section ────────────────────────────────────
function getDefaultSection(sections: string[]): string {
  return sections[0] ?? "Overview";
}

// ─── Section expansion defaults ────────────────────────────────
// Flow: always expanded (primary content)
// Timeline: collapsed if flow exists, expanded otherwise
// Stats: collapsed by default
// Odds: collapsed by default
function getDefaultExpanded(
  section: string,
  hasFlow: boolean,
): boolean {
  switch (section) {
    case "Flow":
      return true;
    case "Timeline":
      return !hasFlow;
    case "Stats":
      return false;
    case "Odds":
      return false;
    case "Overview":
      return true;
    case "Wrap-Up":
      return true;
    default:
      return false;
  }
}

// ─── Collapsible Section Wrapper ───────────────────────────────
function CollapsibleSection({
  title,
  defaultOpen,
  onExpand,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  onExpand?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && onExpand) {
      onExpand();
    }
  };

  return (
    <div id={`section-${title}`} className="scroll-mt-24">
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-neutral-200 hover:bg-neutral-800/30 transition-colors"
      >
        <span>{title}</span>
        <span
          className={`text-xs text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          &#9660;
        </span>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const gameId = Number(id);
  const { data, loading, error } = useGame(gameId);

  const sections = useMemo(() => (data ? getSections(data) : []), [data]);
  const [activeSection, setActiveSection] = useState<string>("");
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reading position store
  const getPosition = useReadingPosition((s) => s.getPosition);
  const savePosition = useReadingPosition((s) => s.savePosition);
  const autoResumePosition = useSettings((s) => s.autoResumePosition);

  // Has flow data (for expansion defaults)
  const hasFlow = data?.game.hasFlow ?? false;

  // Read state - mark as read when user expands Wrap-Up section
  // (matches iOS where expanding wrap-up marks as read)
  const markRead = useReadState((s) => s.markRead);
  const handleWrapUpExpand = useCallback(() => {
    if (data && isFinal(data.game.status)) {
      markRead(data.game.id, data.game.status);
    }
  }, [data, markRead]);

  // ─── Intersection Observer for active section tracking ─────
  useEffect(() => {
    if (!contentRef.current || sections.length === 0) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topSection: string | null = null;
        let topY = Infinity;

        for (const entry of entries) {
          if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            if (rect.top < topY) {
              topY = rect.top;
              // Extract section name from id="section-SectionName"
              const sectionName = entry.target.id.replace("section-", "");
              topSection = sectionName;
            }
          }
        }

        if (topSection) {
          setActiveSection(topSection);
        }
      },
      {
        rootMargin: "-96px 0px -50% 0px", // Account for sticky nav
        threshold: 0,
      },
    );

    // Observe all section elements
    for (const section of sections) {
      const el = document.getElementById(`section-${section}`);
      if (el) {
        observerRef.current.observe(el);
      }
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [sections]);

  // ─── Reading position: save on scroll ──────────────────────
  useEffect(() => {
    if (!data || !data.plays || data.plays.length === 0) return;

    const handleScroll = () => {
      // Find which play is currently in view
      const playElements = document.querySelectorAll("[data-play-index]");
      let closestIndex = 0;
      let closestDistance = Infinity;

      for (const el of playElements) {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - 100); // 100px from top
        if (distance < closestDistance) {
          closestDistance = distance;
          const idx = Number(el.getAttribute("data-play-index"));
          if (!isNaN(idx)) closestIndex = idx;
        }
      }

      if (closestIndex > 0) {
        const play = data.plays.find((p) => p.playIndex === closestIndex);
        savePosition(gameId, {
          playIndex: closestIndex,
          period: play?.quarter,
          gameClock: play?.gameClock,
          periodLabel: play?.periodLabel,
          timeLabel: play?.timeLabel,
          savedAt: new Date().toISOString(),
          homeScore: play?.homeScore,
          awayScore: play?.awayScore,
        });
      }
    };

    // Throttle scroll handler
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
      }
    };

    window.addEventListener("scroll", throttledScroll, { passive: true });
    return () => window.removeEventListener("scroll", throttledScroll);
  }, [data, gameId, savePosition]);

  // ─── Auto-resume reading position ─────────────────────────
  const hasResumed = useRef(false);
  useEffect(() => {
    if (hasResumed.current) return;
    if (!data || !autoResumePosition) return;

    const saved = getPosition(gameId);
    if (!saved) return;

    hasResumed.current = true;

    // Small delay to let the DOM render
    const timeout = setTimeout(() => {
      const playEl = document.querySelector(
        `[data-play-index="${saved.playIndex}"]`,
      );
      if (playEl) {
        playEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [data, autoResumePosition, gameId, getPosition]);

  // ─── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <LoadingSkeleton className="h-40" />
        <LoadingSkeleton count={3} className="h-24" />
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-red-500 text-sm">
        {error ?? "Game not found"}
      </div>
    );
  }

  // Enrich game with clock + scores from latest PBP entry
  const lastPlay = data.plays?.length
    ? data.plays[data.plays.length - 1]
    : null;
  const game = lastPlay
    ? {
        ...data.game,
        currentPeriod: lastPlay.quarter ?? data.game.currentPeriod,
        gameClock: lastPlay.gameClock ?? data.game.gameClock,
        homeScore: lastPlay.homeScore ?? data.game.homeScore,
        awayScore: lastPlay.awayScore ?? data.game.awayScore,
      }
    : data.game;
  return (
    <div className="mx-auto max-w-5xl">
      <GameHeader game={game} />

      <SectionNav
        sections={sections}
        active={activeSection || getDefaultSection(sections)}
        onSelect={setActiveSection}
      />

      <div ref={contentRef} className="py-4 space-y-2">
        {/* ─── Overview (Pregame only) ──────────────────── */}
        {sections.includes("Overview") && (
          <CollapsibleSection
            title="Overview"
            defaultOpen={getDefaultExpanded("Overview", hasFlow)}
          >
            <OverviewSection data={data} />
          </CollapsibleSection>
        )}

        {/* ─── Flow (Final only, always expanded) ───────── */}
        {sections.includes("Flow") && (
          <div id="section-Flow" className="scroll-mt-24">
            <FlowContainer gameId={gameId} socialPosts={data.socialPosts} />
          </div>
        )}

        {/* ─── Timeline ─────────────────────────────────── */}
        {sections.includes("Timeline") && (
          <CollapsibleSection
            title="Timeline"
            defaultOpen={getDefaultExpanded("Timeline", hasFlow)}
          >
            <TimelineSection
              plays={data.plays}
              homeTeamAbbr={game.homeTeamAbbr}
              awayTeamAbbr={game.awayTeamAbbr}
              homeColor={game.homeTeamColorDark}
              awayColor={game.awayTeamColorDark}
            />
          </CollapsibleSection>
        )}

        {/* ─── Stats ────────────────────────────────────── */}
        {sections.includes("Stats") && (
          <CollapsibleSection
            title="Stats"
            defaultOpen={getDefaultExpanded("Stats", hasFlow)}
          >
            <StatsSection
              playerStats={data.playerStats}
              teamStats={data.teamStats}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
              leagueCode={game.leagueCode}
              homeColor={game.homeTeamColorDark}
              awayColor={game.awayTeamColorDark}
              nhlSkaters={data.nhlSkaters}
              nhlGoalies={data.nhlGoalies}
            />
          </CollapsibleSection>
        )}

        {/* ─── Odds ─────────────────────────────────────── */}
        {sections.includes("Odds") && (
          <CollapsibleSection
            title="Odds"
            defaultOpen={getDefaultExpanded("Odds", hasFlow)}
          >
            <OddsSection odds={data.odds} />
          </CollapsibleSection>
        )}

        {/* ─── Wrap-Up (Final only) ─────────────────────── */}
        {sections.includes("Wrap-Up") && (
          <CollapsibleSection
            title="Wrap-Up"
            defaultOpen={getDefaultExpanded("Wrap-Up", hasFlow)}
            onExpand={handleWrapUpExpand}
          >
            <WrapUpSection data={data} />
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
