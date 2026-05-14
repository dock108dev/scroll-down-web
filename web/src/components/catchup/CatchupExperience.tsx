"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { NewMomentsBanner } from "./NewMomentsBanner";
import { CatchupSettingsDrawer } from "./CatchupSettingsDrawer";
import { CatchupErrorBoundary } from "./CatchupErrorBoundary";
import { useSettings } from "@/stores/settings";
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
  const {
    cards,
    isFinal,
    lastPlayIndex,
    loading,
    error,
    refresh,
    hasNewDeck,
    applyPendingDeck,
  } = useCatchupCards(gameId);
  const savedEntry = useCatchupProgress((s) => s.entries[gameId]);
  const setProgress = useCatchupProgress((s) => s.setProgress);
  const markCompleted = useCatchupProgress((s) => s.markCompleted);
  const autoRevealDelayMs = useSettings((s) => s.autoRevealDelayMs);
  const autoAdvanceDelayMs = useSettings((s) => s.autoAdvanceDelayMs);

  const [activeIndex, setActiveIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [targetIndex, setTargetIndex] = useState<number | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revealedPlayIds, setRevealedPlayIds] = useState<Record<string, true>>({});
  // Tracks which cards' phase machines have completed the `advance`
  // transition (narrative fade-in done). Auto-advance is gated on this
  // rather than on `revealedPlayIds` so the timer only starts after a
  // fully-revealed card per the BRAINDUMP 4-phase model.
  const [advanceReadyPlayIds, setAdvanceReadyPlayIds] = useState<Record<string, true>>({});

  // ── Debug overlay toggle ──────────────────────────────
  // `?debug=true` enables per-card validation overlays on play and rhythm
  // cards. Read from the URL once on mount; the value is stable for the
  // lifetime of the catch-up flow so we don't subscribe to navigation events.
  const [showDebug] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "true";
  });

  // ── Take over the viewport while the catch-up flow is mounted ─
  // The flow's page-shell is `height: 100dvh − topnav` and owns its own
  // scroll surface (the scroller). Without locking the document body,
  // the global Footer below `main` pushes total content past the
  // viewport and the page scrolls *behind* the experience — which on
  // iOS hides our catch-up header behind the URL bar shrink/grow
  // dance. Lock body overflow to make the catch-up flow truly modal.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

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
    setRevealedPlayIds({});
    setAdvanceReadyPlayIds({});
    setSettingsOpen(false);
    setActiveIndex(0);
    setTargetIndex(0);
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

  const activeSlide = baseSlides[activeIndex];
  const activePlayCard = activeSlide?.kind === "play" ? activeSlide : null;
  const activePlayId = activePlayCard?.cardId ?? null;
  const activePlayRevealed = activePlayId ? revealedPlayIds[activePlayId] === true : false;
  const activePlayAdvanceReady = activePlayId ? advanceReadyPlayIds[activePlayId] === true : false;

  // Live mirror of activePlayId. The auto-advance timer captures this ref
  // (not the closure) so a callback that fires in the narrow window between
  // the user scrolling and React re-rendering reads the post-scroll value
  // and skips the stale advance. Sync via useLayoutEffect so the ref is
  // current before the browser paints the new render and before any timer
  // macrotask runs.
  const activePlayIdRef = useRef<string | null>(activePlayId);
  useLayoutEffect(() => {
    activePlayIdRef.current = activePlayId;
  }, [activePlayId]);

  const revealPlay = useCallback((cardId: string) => {
    setRevealedPlayIds((prev) => (
      prev[cardId] ? prev : { ...prev, [cardId]: true }
    ));
  }, []);

  const markAdvanceReady = useCallback((cardId: string) => {
    setAdvanceReadyPlayIds((prev) => (
      prev[cardId] ? prev : { ...prev, [cardId]: true }
    ));
  }, []);

  const advanceFromPlay = useCallback((cardId: string) => {
    if (activePlayId !== cardId) return;
    setTargetIndex(Math.min(activeIndex + 1, slideKeys.length - 1));
  }, [activeIndex, activePlayId, slideKeys.length]);

  // Resume to saved progress on first load.
  const initialIndex = useMemo(() => {
    if (cards.length === 0) return 0;
    const saved = savedEntry?.cardIndex ?? 0;
    return Math.min(Math.max(0, saved), slideKeys.length - 1);
  }, [savedEntry, cards.length, slideKeys.length]);

  // Auto-advance fires only after the active card has fully revealed
  // (phase machine reached `advance`). The timer callback reads
  // activePlayIdRef.current — not the closure — to close the race window
  // where the timer fires just before React processes a scroll-driven
  // activeIndex change. Without the ref read, both the timer's
  // advanceFromPlay closure and its activePlayId arg are captured from the
  // same render, so the secondary `activePlayId !== cardId` guard inside
  // advanceFromPlay can't tell that the user has already moved on.
  useEffect(() => {
    if (!activePlayId) return;
    if (!activePlayAdvanceReady) return;
    if (autoAdvanceDelayMs <= 0) return;
    if (settingsOpen) return;
    const capturedId = activePlayId;
    const timer = window.setTimeout(() => {
      if (activePlayIdRef.current !== capturedId) return;
      advanceFromPlay(capturedId);
    }, autoAdvanceDelayMs);
    return () => window.clearTimeout(timer);
  }, [activePlayId, activePlayAdvanceReady, autoAdvanceDelayMs, settingsOpen, advanceFromPlay]);

  // ── Auto-apply newer decks when caught up ─────────────
  // The hook stages newer decks as `pendingDeck` rather than swapping in
  // place — that prevents yanking the user's scroll mid-deck. But on the
  // live tail card the user *is* caught up and waiting for new plays;
  // requiring them to tap the banner makes the live experience feel
  // frozen. Auto-apply when the active slide is the tail and the deck
  // hasn't been revealed yet. Mid-deck users still get the banner.
  const onTail = !isFinal && cards.length > 0 && activeIndex >= slideKeys.length - 1;
  useEffect(() => {
    if (!hasNewDeck) return;
    if (!onTail) return;
    applyPendingDeck();
  }, [hasNewDeck, onTail, applyPendingDeck]);

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
    <div
      className="catchup-page-shell"
      data-auto-reveal-ms={autoRevealDelayMs}
      data-auto-advance-ms={autoAdvanceDelayMs}
      data-settings-open={settingsOpen ? "true" : "false"}
      data-active-play-id={activePlayId ?? ""}
      data-active-play-revealed={activePlayRevealed ? "true" : "false"}
      data-active-play-advance-ready={activePlayAdvanceReady ? "true" : "false"}
    >
      <CatchupHeader
        awayTeamAbbr={awayTeamAbbr}
        homeTeamAbbr={homeTeamAbbr}
        onRestart={handleRestart}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((open) => !open)}
      />
      <CatchupSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NewMomentsBanner visible={hasNewDeck && !onTail && !revealed} onApply={applyPendingDeck} />
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
        targetIndex={targetIndex}
      >
        {[
          ...baseSlides.map((card, i) => {
            const boundaryContext = {
              gameId,
              cardId: card.cardId,
              cardKind: card.kind,
              eventId: card.kind === "play" ? card.playIndex : undefined,
              inning: "inning" in card ? card.inning : undefined,
              half: "inningHalf" in card ? card.inningHalf : undefined,
              rawEventSummary: card.kind === "play"
                ? {
                    eventType: card.eventType,
                    count: card.situationBefore.displayCountBefore,
                    basesBefore: card.situationBefore.baseState,
                    basesAfter: card.baseStateAfter,
                  }
                : undefined,
            };
            const wrapSlide = (node: React.ReactNode) => (
              <CatchupErrorBoundary
                key={card.cardId}
                boundaryKey={card.cardId}
                title={card.kind === "play" ? "Could not render this play." : "Could not render this card."}
                context={boundaryContext}
                onSkip={i < slideKeys.length - 1 ? () => setTargetIndex(i + 1) : undefined}
                onRetry={refresh}
              >
                {node}
              </CatchupErrorBoundary>
            );
            if (card.kind === "scene-setter") {
              return wrapSlide(
                <SceneSetterCard
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
              return wrapSlide(
                <RhythmCard
                  card={card}
                  isActive={activeIndex === i}
                  showDebug={showDebug}
                />
              );
            }
            if (card.kind === "play") {
              return wrapSlide(
                <CatchupCard
                  card={card}
                  homeTeamAbbr={homeTeamAbbr}
                  awayTeamAbbr={awayTeamAbbr}
                  isActive={activeIndex === i}
                  isRevealed={revealedPlayIds[card.cardId] === true}
                  onReveal={revealPlay}
                  onAdvanceReady={markAdvanceReady}
                  autoRevealDelayMs={autoRevealDelayMs}
                  showDebug={showDebug}
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
    </div>
  );
}

type TailKind = "none" | "gate" | "live" | "final";

function CatchupHeader({
  awayTeamAbbr,
  homeTeamAbbr,
  onRestart,
  settingsOpen,
  onToggleSettings,
}: {
  awayTeamAbbr: string;
  homeTeamAbbr: string;
  onRestart: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
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
      <div className="catchup-header-controls">
        <button
          type="button"
          onClick={onToggleSettings}
          className="catchup-header-action catchup-header-icon-action"
          aria-label="Open catch-up settings"
          aria-expanded={settingsOpen}
          title="Catch-up settings"
          data-testid="catchup-settings-button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.28.35.5.68.6 1H20a2 2 0 1 1 0 4h-.09c-.1.32-.32.65-.51 1Z" />
          </svg>
        </button>
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
