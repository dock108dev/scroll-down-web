"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCatchupCards } from "@/hooks/useCatchupCards";
import { useCatchupProgress } from "@/stores/catchup-progress";
import { CatchupScrollContainer } from "./CatchupScrollContainer";
import { CatchupCard } from "./CatchupCard";
import { SceneSetterCard } from "./SceneSetterCard";
import { RhythmCard } from "./RhythmCard";
import { CatchupProgress } from "./CatchupProgress";
import { RevealGate } from "./RevealGate";
import { FinalReveal } from "./FinalReveal";
import type { CatchupCard as CatchupCardData } from "@/lib/types";

interface CatchupExperienceProps {
  gameId: number;
}

/**
 * Top-level catch-up flow. Owns:
 *   - card fetch (via useCatchupCards)
 *   - saved progress restore + persistence
 *   - active-card reporting from the scroll container
 *   - reveal state (gate vs final)
 *
 * Layout: a vertical scroll-snap deck. One card per viewport. The last
 * "card" depends on game state:
 *   - final game → reveal gate, then final reveal
 *   - live game → "you're caught up" with a manual refresh
 */
export function CatchupExperience({ gameId }: CatchupExperienceProps) {
  const { cards, isFinal, lastPlayIndex, loading, error, refresh } = useCatchupCards(gameId);
  const savedEntry = useCatchupProgress((s) => s.entries[gameId]);
  const setProgress = useCatchupProgress((s) => s.setProgress);
  const markCompleted = useCatchupProgress((s) => s.markCompleted);

  const [activeIndex, setActiveIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [restartToken, setRestartToken] = useState(0);

  // ── Persist progress whenever the active card changes ───
  useEffect(() => {
    if (cards.length === 0) return;
    setProgress(gameId, activeIndex, lastPlayIndex);
  }, [activeIndex, gameId, lastPlayIndex, cards.length, setProgress]);

  // ── Mark completed once the user reveals ───────────────
  const handleReveal = useCallback(() => {
    setRevealed(true);
    markCompleted(gameId);
  }, [gameId, markCompleted]);

  // ── Restart: clear reveal, reset progress, snap to slide 0 ─
  const handleRestart = useCallback(() => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Start over from the first pitch? Your reveal will be reset too.");
      if (!ok) return;
    }
    setRevealed(false);
    setActiveIndex(0);
    setProgress(gameId, 0, lastPlayIndex);
    setRestartToken((t) => t + 1);
  }, [gameId, lastPlayIndex, setProgress]);

  // Pull team metadata from the scene setter (always index 0 in a fresh
  // fetch). If the deck loaded with `since`, the scene setter is absent —
  // fall back to placeholder labels and let the parent handle naming.
  const sceneSetter = useMemo(
    () => cards.find((c): c is Extract<CatchupCardData, { kind: "scene-setter" }> => c.kind === "scene-setter"),
    [cards],
  );
  const homeTeamAbbr = sceneSetter?.homeTeamAbbr ?? "HME";
  const awayTeamAbbr = sceneSetter?.awayTeamAbbr ?? "AWY";
  const homeTeam = sceneSetter?.homeTeam ?? "Home";
  const awayTeam = sceneSetter?.awayTeam ?? "Away";

  // ── Compose the slide list ─────────────────────────────
  // Scene setter + play cards + (gate or live caught-up) — and after reveal,
  // a Final slide replaces the gate.

  const baseSlides = cards;
  const tailSlide: TailKind = revealed
    ? "final"
    : isFinal && cards.length > 0
      ? "gate"
      : !isFinal && cards.length > 0
        ? "live"
        : "none";

  const slideKeys = useMemo(() => {
    const ks = baseSlides.map((c) => c.cardId);
    if (tailSlide !== "none") ks.push(`${gameId}-tail-${tailSlide}`);
    return ks;
  }, [baseSlides, tailSlide, gameId]);

  // Resume to saved progress on first load.
  const initialIndex = useMemo(() => {
    if (cards.length === 0) return 0;
    const saved = savedEntry?.cardIndex ?? 0;
    return Math.min(Math.max(0, saved), slideKeys.length - 1);
  }, [savedEntry, cards.length, slideKeys.length]);

  if (loading && cards.length === 0) {
    return <CatchupSkeleton />;
  }

  if (error && cards.length === 0) {
    return (
      <div className="catchup-error">
        <p>We couldn&rsquo;t load this game.</p>
        <button onClick={() => refresh()} className="catchup-error-retry">Retry</button>
        <Link href="/" className="catchup-error-back">Back to games</Link>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="catchup-empty">
        <p>No key plays yet — check back when the game has started.</p>
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">Back to games</Link>
      </div>
    );
  }

  return (
    <>
      <CatchupHeader
        awayTeamAbbr={awayTeamAbbr}
        homeTeamAbbr={homeTeamAbbr}
        onRestart={handleRestart}
      />
      <CatchupProgress
        total={slideKeys.length}
        currentIndex={activeIndex}
        isFinal={isFinal}
      />
      <CatchupScrollContainer
        itemKeys={slideKeys}
        initialIndex={initialIndex}
        onActiveIndexChange={setActiveIndex}
        restartToken={restartToken}
      >
        {[
          ...baseSlides.map((card, i) => {
            if (card.kind === "scene-setter") {
              return (
                <SceneSetterCard
                  key={card.cardId}
                  card={card}
                  isActive={activeIndex === i}
                />
              );
            }
            if (
              card.kind === "inning-transition" ||
              card.kind === "quiet-stretch" ||
              card.kind === "late-game" ||
              card.kind === "final-setup"
            ) {
              return (
                <RhythmCard
                  key={card.cardId}
                  card={card}
                  isActive={activeIndex === i}
                />
              );
            }
            if (card.kind === "play") {
              return (
                <CatchupCard
                  key={card.cardId}
                  card={card}
                  homeTeamAbbr={homeTeamAbbr}
                  awayTeamAbbr={awayTeamAbbr}
                  isActive={activeIndex === i}
                />
              );
            }
            return null;
          }),
          tailSlide === "gate" && (
            <RevealGate
              key="gate"
              awayTeam={awayTeam}
              homeTeam={homeTeam}
              isActive={activeIndex === baseSlides.length}
              onReveal={handleReveal}
            />
          ),
          tailSlide === "final" && (
            <FinalReveal
              key="final"
              gameId={gameId}
              homeTeamAbbr={homeTeamAbbr}
              awayTeamAbbr={awayTeamAbbr}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />
          ),
          tailSlide === "live" && (
            <LiveCaughtUp
              key="live"
              awayTeam={awayTeam}
              homeTeam={homeTeam}
              onRefresh={refresh}
              isActive={activeIndex === baseSlides.length}
            />
          ),
        ].filter(Boolean) as React.ReactNode[]}
      </CatchupScrollContainer>
    </>
  );
}

type TailKind = "none" | "gate" | "live" | "final";

function CatchupHeader({
  awayTeamAbbr,
  homeTeamAbbr,
  onRestart,
}: {
  awayTeamAbbr: string;
  homeTeamAbbr: string;
  onRestart: () => void;
}) {
  return (
    <div className="catchup-header">
      <Link href="/" className="catchup-header-action" aria-label="Back to games">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>Games</span>
      </Link>
      <span className="catchup-header-matchup">
        {awayTeamAbbr} <span className="text-neutral-700">@</span> {homeTeamAbbr}
      </span>
      <button
        type="button"
        onClick={onRestart}
        className="catchup-header-action"
        aria-label="Restart catch-up from the first pitch"
        title="Start over"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        <span>Restart</span>
      </button>
    </div>
  );
}

function LiveCaughtUp({
  awayTeam,
  homeTeam,
  onRefresh,
  isActive,
}: {
  awayTeam: string;
  homeTeam: string;
  onRefresh: () => Promise<void>;
  isActive: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [justChecked, setJustChecked] = useState(false);
  const handle = async () => {
    setRefreshing(true);
    setJustChecked(false);
    try {
      await onRefresh();
      setJustChecked(true);
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <section
      data-testid="live-caught-up"
      data-active={isActive ? "true" : "false"}
      className="live-caught-up"
    >
      <div className="live-caught-up-inner">
        <div className="live-caught-up-pulse" aria-hidden>
          <span className="live-caught-up-pulse-ring" />
          <span className="live-caught-up-pulse-dot" />
        </div>
        <p className="catchup-eyebrow">Live</p>
        <h2 className="live-caught-up-headline">You&rsquo;re all caught up</h2>
        <p className="live-caught-up-sub">
          {awayTeam} at {homeTeam} is still in progress. Tap below when you want to check for new key plays.
        </p>
        <button
          onClick={handle}
          disabled={refreshing}
          className="live-caught-up-button"
        >
          {refreshing ? "Checking…" : "Check for new plays"}
        </button>
        {justChecked && !refreshing && (
          <p className="live-caught-up-fineprint">No new key plays yet — try again in a minute.</p>
        )}
        <Link href="/" className="live-caught-up-back">
          Back to games
        </Link>
      </div>
    </section>
  );
}

function CatchupSkeleton() {
  return (
    <div className="catchup-loading">
      <div className="catchup-loading-bar catchup-loading-bar-thin" />
      <div className="catchup-loading-bar catchup-loading-bar-field" />
      <div className="catchup-loading-bar" />
      <div className="catchup-loading-bar catchup-loading-bar-half" />
    </div>
  );
}
