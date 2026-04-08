"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameDetail } from "@/hooks/useGameDetail";
import { isFinal } from "@/lib/types";
import type { GameStatus } from "@/lib/types";
import { getSections, getDefaultSection, getDefaultExpanded } from "./sections";
import { GameHeader } from "@/components/game/GameHeader";
import { SectionNav } from "@/components/game/SectionNav";
import { MiniScorebar } from "@/components/game/MiniScorebar";
import { FlowContainer } from "@/components/game/FlowContainer";
import { TimelineSection } from "@/components/game/TimelineSection";
import { PlayerStatsSection, TeamStatsSection } from "@/components/game/StatsSection";
import { OddsSection } from "@/components/game/OddsSection";
import { WrapUpSection } from "@/components/game/WrapUpSection";
import { MLBAdvancedStatsSection } from "@/components/game/MLBAdvancedStatsSection";
import { PregameBuzzSection } from "@/components/game/PregameBuzzSection";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Spinner } from "@/components/shared/Spinner";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { useReadingPosition } from "@/stores/reading-position";
import { useReveal } from "@/stores/reveal";
import { useSettings } from "@/stores/settings";
import { useGameData } from "@/stores/game-data";
import { POLLING } from "@/lib/config";
import { resolveTeamColor } from "@/lib/utils";
import { useSectionLayout } from "@/stores/section-layout";
import { useAutoRetry } from "@/hooks/useAutoRetry";
import { useRealtimeSubscription } from "@/realtime/useRealtimeSubscription";
import { gamePbpChannel } from "@/realtime/channels";
import { trackEvent, initScrollTracking } from "@/lib/analytics";
import { InlineFeedback } from "@/components/shared/InlineFeedback";

// ─── Main Page Component ───────────────────────────────────────

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const gameId = Number(id);
  const router = useRouter();
  const { data, core, loading, error, refetch: refetchDetail } = useGameDetail(gameId);
  const { retryCount, manualRetry } = useAutoRetry({ error, loading, refetch: refetchDetail });

  const sections = useMemo(() => (data ? getSections(data) : []), [data]);
  const [activeSection, setActiveSection] = useState<string>("");
  const [showMiniBar, setShowMiniBar] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ─── Analytics ──────────────────────────────────────────────
  useEffect(() => {
    trackEvent("game_view", { gameId: id });
    return initScrollTracking();
  }, [id]);

  // Reading position store
  const getPosition = useReadingPosition((s) => s.getPosition);
  const savePosition = useReadingPosition((s) => s.savePosition);
  const autoResumePosition = useSettings((s) => s.autoResumePosition);

  // Has flow data (for expansion defaults)
  const hasFlow = data?.game.hasFlow ?? false;

  // ─── Read state ────────────────────────────────────────────
  const isRevealed = useReveal((s) => s.isRevealed);
  const markRead = useReveal((s) => s.markRead);
  const gameIsRead = isRevealed(gameId);
  const handleWrapUpExpand = useCallback(() => {
    if (data && isFinal(data.game.status, data.game)) {
      markRead(data.game.id);
    }
  }, [data, markRead]);

  // ─── Per-game section layout persistence ───────────────────
  const sectionLayout = useSectionLayout();
  const savedLayout = sectionLayout.getLayout(gameId);

  // Compute default expanded list (used on first visit only)
  const status: GameStatus = data?.game.status ?? "scheduled";
  const defaultExpanded = useMemo(
    () => sections.filter((s) => getDefaultExpanded(s, hasFlow, status, gameIsRead)),
    [sections, hasFlow, status, gameIsRead],
  );

  // Single-section pages always expand that section so the user doesn't
  // land on a blank page. Once a second section appears, respect user prefs.
  const expandedSections =
    sections.length === 1
      ? sections
      : (savedLayout ?? defaultExpanded);

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

  // ── PBP realtime subscription (only when Timeline is expanded) ──
  const needsPbpRefresh = useGameData((s) => s.needsPbpRefresh);
  const clearPbpRefresh = useGameData((s) => s.clearPbpRefresh);
  const timelineOpen = isSectionOpen("Timeline");

  const pbpChannels = useMemo(
    () => (timelineOpen ? [gamePbpChannel(gameId)] : []),
    [timelineOpen, gameId],
  );

  useRealtimeSubscription(pbpChannels);

  // Watch PBP recovery flag — refetch full detail to recover
  useEffect(() => {
    if (!needsPbpRefresh.has(gameId)) return;
    clearPbpRefresh(gameId);
    refetchDetail({ silent: true });
  }, [needsPbpRefresh, gameId, clearPbpRefresh, refetchDetail]);

  // New play count for badge on collapsed Timeline
  const savedPos = data ? getPosition(gameId) : undefined;
  const newPlayCount = useMemo(() => {
    if (!data?.plays) return 0;
    const saved = savedPos?.playCount;
    if (saved == null) return 0;
    return Math.max(0, data.plays.length - saved);
  }, [data?.plays, savedPos?.playCount]);

  // ─── Intersection Observer for active section tracking ─────
  useEffect(() => {
    if (!contentRef.current || sections.length === 0) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let topSection: string | null = null;
        let topY = Infinity;

        for (const entry of entries) {
          if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            if (rect.top < topY) {
              topY = rect.top;
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
        rootMargin: "-96px 0px -50% 0px",
        threshold: 0,
      },
    );

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

  // ─── Reading position: save on scroll (no scores) ──────────
  useEffect(() => {
    if (!data || !data.plays || data.plays.length === 0) return;

    const handleScroll = () => {
      const playElements = document.querySelectorAll("[data-play-index]");
      let closestIndex = 0;
      let closestDistance = Infinity;

      for (const el of playElements) {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - 100);
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
          playCount: data.plays.length,
          savedAt: new Date().toISOString(),
        });
      }
    };

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

  // ─── Mini scorebar: show when GameHeader scrolls out ───────
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const headerH = getComputedStyle(document.documentElement)
      .getPropertyValue("--header-h")
      .trim() || "56px";
    const obs = new IntersectionObserver(
      ([entry]) => setShowMiniBar(!entry.isIntersecting),
      { rootMargin: `-${parseInt(headerH, 10)}px 0px 0px 0px`, threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading]);

  // ─── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <div className="md:hidden">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors min-h-[44px]"
            aria-label="Go back"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        </div>
        <LoadingSkeleton className="h-40" />
        <LoadingSkeleton count={3} className="h-24" />
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
        <div className="md:hidden">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors min-h-[44px]"
            aria-label="Go back"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        </div>
        <div className="py-12 text-center space-y-4">
          <p className="text-sm text-neutral-400">
            {retryCount >= 3
              ? "The service may be temporarily unavailable."
              : "We\u2019re having trouble loading game data right now."}
          </p>
          <button
            onClick={manualRetry}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg bg-neutral-800 text-neutral-200 hover:text-neutral-50 border border-neutral-700 transition disabled:opacity-50"
          >
            {loading ? <><Spinner size={14} /> Retrying&hellip;</> : "Retry"}
          </button>
          <p className="text-xs text-neutral-600">
            {retryCount >= 3
              ? "Automatic retries exhausted. You can still retry manually."
              : retryCount > 0
                ? "Retrying automatically\u2026"
                : "Check back shortly \u2014 game data updates regularly."}
          </p>
        </div>
      </div>
    );
  }

  // Use enriched core from canonical store (already has last-play enrichment)
  const game = core ?? data.game;
  const homeColor = resolveTeamColor(game.homeTeamColorLight, game.homeTeamColorDark);
  const awayColor = resolveTeamColor(game.awayTeamColorLight, game.awayTeamColorDark);

  return (
    <div data-testid="page-game-detail" className="mx-auto max-w-5xl">
      {/* Mobile back button */}
      <div className="md:hidden px-4 pt-3 pb-1">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors min-h-[44px]"
          aria-label="Go back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
      </div>
      <div ref={headerRef}>
        <GameHeader game={game} />
      </div>

      <div
        className="sticky z-30 bg-neutral-950"
        style={{ top: "var(--header-h)" }}
      >
        <MiniScorebar game={game} visible={showMiniBar} />
        <SectionNav
          sections={sections}
          active={activeSection || getDefaultSection(sections)}
          onSelect={setActiveSection}
        />
      </div>

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
              homeColor={homeColor}
              awayColor={awayColor}
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
              mlbBatters={data.mlbBatters}
              mlbPitchers={data.mlbPitchers}
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
              homeColor={homeColor}
              awayColor={awayColor}
            />
          </CollapsibleSection>
        )}

        {/* ─── Advanced Stats (MLB only) ──────────────── */}
        {sections.includes("Advanced Stats") && (
          <CollapsibleSection
            title="Advanced Stats"
            open={isSectionOpen("Advanced Stats")}
            onToggle={() => handleToggle("Advanced Stats")}
          >
            <MLBAdvancedStatsSection
              teamStats={data.mlbAdvancedStats}
              playerStats={data.mlbAdvancedPlayerStats}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
              homeColor={homeColor}
              awayColor={awayColor}
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

      {!error && <InlineFeedback context="game" />}
    </div>
  );
}
