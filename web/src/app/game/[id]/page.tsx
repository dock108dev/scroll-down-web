"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { isFinal, isLive, isPregame } from "@/lib/types";
import type { GameDetailResponse, GameStatus } from "@/lib/types";
import { GameHeader } from "@/components/game/GameHeader";
import { SectionNav } from "@/components/game/SectionNav";
import { FlowContainer } from "@/components/game/FlowContainer";
import { TimelineSection } from "@/components/game/TimelineSection";
import { PlayerStatsSection, TeamStatsSection } from "@/components/game/StatsSection";
import { OddsSection } from "@/components/game/OddsSection";
import { WrapUpSection } from "@/components/game/WrapUpSection";
import { PregameBuzzSection } from "@/components/game/PregameBuzzSection";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { useReadingPosition } from "@/stores/reading-position";
import { useReadState } from "@/stores/read-state";
import { useSettings } from "@/stores/settings";
import { POLLING } from "@/lib/config";
import { useSectionLayout } from "@/stores/section-layout";
import { usePinnedGames } from "@/stores/pinned-games";

// ─── Section definitions by status ─────────────────────────────
function getSections(data: GameDetailResponse): string[] {
  const status = data.game.status;
  const hasPregamePosts = data.socialPosts?.some(
    (p) =>
      p.gamePhase === "pregame" &&
      (p.tweetText || p.imageUrl || p.videoUrl) &&
      p.revealLevel !== "post",
  );
  const hasMainlineOdds = data.odds?.some(
    (o) =>
      ["spread", "moneyline", "total"].includes(o.marketType) &&
      !o.isClosingLine &&
      o.price != null,
  );
  const hasBuzz = hasPregamePosts || hasMainlineOdds;

  if (isPregame(status)) {
    const s: string[] = [];
    if (hasBuzz) s.push("Pregame Buzz");
    s.push("Odds");
    return s;
  }

  if (isLive(status)) {
    return ["Timeline", "Player Stats", "Team Stats", "Odds"];
  }

  if (isFinal(status)) {
    const s: string[] = [];
    if (hasBuzz) s.push("Pregame Buzz");
    s.push("Flow", "Timeline", "Player Stats", "Team Stats", "Odds", "Wrap-Up");
    return s;
  }

  // Fallback
  const s: string[] = [];
  if (hasBuzz) s.push("Pregame Buzz");
  s.push("Odds");
  return s;
}

// ─── Default active section ────────────────────────────────────
function getDefaultSection(sections: string[]): string {
  return sections[0] ?? "Pregame Buzz";
}

// ─── Section expansion defaults ────────────────────────────────
// Flow: always expanded (primary content)
// Timeline: collapsed if flow exists, expanded otherwise
// Stats: collapsed by default
// Odds: collapsed by default
function getDefaultExpanded(
  section: string,
  hasFlow: boolean,
  status: GameStatus,
): boolean {
  switch (section) {
    case "Pregame Buzz":
      return isPregame(status);
    case "Flow":
      return true;
    case "Timeline":
      return !hasFlow;
    case "Player Stats":
    case "Team Stats":
      return false;
    case "Odds":
      return false;
    case "Wrap-Up":
      return true;
    default:
      return false;
  }
}

// ─── Collapsible Section Wrapper (controlled) ────────────────────
function CollapsibleSection({
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div id={`section-${title}`} className="scroll-mt-24" style={{ scrollMarginTop: "calc(var(--header-h) + 40px)" }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-neutral-200 hover:bg-neutral-800/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
          {!open && badge}
        </span>
        <span
          className={`text-xs text-neutral-500 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
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

  // ─── Sync pinned chip scores with latest game data ────────
  const syncPinned = usePinnedGames((s) => s.syncDisplayData);
  useEffect(() => {
    if (!data) return;
    const g = data.game;
    const lastPlay = data.plays?.length
      ? data.plays[data.plays.length - 1]
      : null;
    syncPinned([
      {
        id: g.id,
        awayTeamAbbr: g.awayTeamAbbr,
        homeTeamAbbr: g.homeTeamAbbr,
        awayScore: lastPlay?.awayScore ?? g.awayScore,
        homeScore: lastPlay?.homeScore ?? g.homeScore,
        status: g.status,
      },
    ]);
  }, [data, syncPinned]);

  // ─── Per-game section layout persistence ───────────────────
  const sectionLayout = useSectionLayout();
  const savedLayout = sectionLayout.getLayout(gameId);

  // Compute default expanded list (used on first visit only)
  const status: GameStatus = data?.game.status ?? "scheduled";
  const defaultExpanded = useMemo(
    () => sections.filter((s) => getDefaultExpanded(s, hasFlow, status)),
    [sections, hasFlow, status],
  );

  // Persisted layout wins; otherwise use defaults
  const expandedSections = savedLayout ?? defaultExpanded;

  const isSectionOpen = (section: string) =>
    expandedSections.includes(section);

  const handleToggle = useCallback(
    (section: string, onExpand?: () => void) => {
      const wasOpen = expandedSections.includes(section);
      sectionLayout.toggleSection(gameId, section, expandedSections);
      if (!wasOpen && onExpand) onExpand();
    },
    [expandedSections, gameId, sectionLayout],
  );

  // New play count for badge on collapsed Timeline
  const savedPos = data ? getPosition(gameId) : undefined;
  const newPlayCount = useMemo(() => {
    if (!data?.plays) return 0;
    const saved = savedPos?.playCount;
    if (saved == null) return 0;
    return Math.max(0, data.plays.length - saved);
  }, [data?.plays, savedPos?.playCount]);

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
    }, POLLING.READING_RESUME_DELAY_MS);

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
        {/* ─── Pregame Buzz ──────────────────────────────── */}
        {sections.includes("Pregame Buzz") && (
          <CollapsibleSection
            title="Pregame Buzz"
            open={isSectionOpen("Pregame Buzz")}
            onToggle={() => handleToggle("Pregame Buzz")}
          >
            <PregameBuzzSection data={data} />
          </CollapsibleSection>
        )}

        {/* ─── Flow (Final only) ────────────────────────── */}
        {sections.includes("Flow") && (
          <CollapsibleSection
            title="Flow"
            open={isSectionOpen("Flow")}
            onToggle={() => handleToggle("Flow")}
          >
            <FlowContainer gameId={gameId} socialPosts={data.socialPosts} />
          </CollapsibleSection>
        )}

        {/* ─── Timeline ─────────────────────────────────── */}
        {sections.includes("Timeline") && (
          <CollapsibleSection
            title="Timeline"
            open={isSectionOpen("Timeline")}
            onToggle={() => handleToggle("Timeline")}
            badge={
              newPlayCount > 0 ? (
                <span className="text-[11px] font-medium text-amber-400/80">
                  {newPlayCount} new play{newPlayCount !== 1 ? "s" : ""}
                </span>
              ) : undefined
            }
          >
            <TimelineSection
              gameId={gameId}
              plays={data.plays}
              homeTeamAbbr={game.homeTeamAbbr}
              awayTeamAbbr={game.awayTeamAbbr}
              homeColor={game.homeTeamColorDark}
              awayColor={game.awayTeamColorDark}
            />
          </CollapsibleSection>
        )}

        {/* ─── Player Stats ─────────────────────────────── */}
        {sections.includes("Player Stats") && (
          <CollapsibleSection
            title="Player Stats"
            open={isSectionOpen("Player Stats")}
            onToggle={() => handleToggle("Player Stats")}
          >
            <PlayerStatsSection
              playerStats={data.playerStats}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
              leagueCode={game.leagueCode}
              nhlSkaters={data.nhlSkaters}
              nhlGoalies={data.nhlGoalies}
            />
          </CollapsibleSection>
        )}

        {/* ─── Team Stats ──────────────────────────────── */}
        {sections.includes("Team Stats") && (
          <CollapsibleSection
            title="Team Stats"
            open={isSectionOpen("Team Stats")}
            onToggle={() => handleToggle("Team Stats")}
          >
            <TeamStatsSection
              teamStats={data.teamStats}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
              leagueCode={game.leagueCode}
              homeColor={game.homeTeamColorDark}
              awayColor={game.awayTeamColorDark}
            />
          </CollapsibleSection>
        )}

        {/* ─── Odds ─────────────────────────────────────── */}
        {sections.includes("Odds") && (
          <CollapsibleSection
            title="Odds"
            open={isSectionOpen("Odds")}
            onToggle={() => handleToggle("Odds")}
          >
            <OddsSection odds={data.odds} homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
          </CollapsibleSection>
        )}

        {/* ─── Wrap-Up (Final only) ─────────────────────── */}
        {sections.includes("Wrap-Up") && (
          <CollapsibleSection
            title="Wrap-Up"
            open={isSectionOpen("Wrap-Up")}
            onToggle={() => handleToggle("Wrap-Up", handleWrapUpExpand)}
          >
            <WrapUpSection data={data} />
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
