"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface CatchupScrollContainerProps {
  /** Stable identifiers for each scroll-snap slide. */
  itemKeys: string[];
  /** Initial slide index to scroll to on mount. */
  initialIndex?: number;
  /** Fired when the centered card changes. */
  onActiveIndexChange?: (index: number) => void;
  /** Bumping this value snaps the scroller back to slide 0 (used by Restart). */
  restartToken?: number;
  children: React.ReactNode;
}

/**
 * Vertical scroll-snap container for the catch-up deck. Uses a single
 * IntersectionObserver to determine which child slide is currently in view
 * and reports the active index up to the parent. The parent passes that
 * index back into individual cards so each card knows when to play.
 *
 * The container itself owns:
 *   - scroll-snap container styling
 *   - initial-index restore (e.g. resuming saved progress)
 *   - active-index detection
 *
 * It does NOT own card rendering, animation, or progress persistence — those
 * are the parent's job.
 */
export function CatchupScrollContainer({
  itemKeys,
  initialIndex = 0,
  onActiveIndexChange,
  restartToken,
  children,
}: CatchupScrollContainerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const restoredRef = useRef(false);

  // ── Active-card detection via IntersectionObserver ───────
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (slideRefs.current.size === 0) return;

    const seen = new Map<number, number>(); // index → intersectionRatio
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idxAttr = entry.target.getAttribute("data-slide-index");
          if (idxAttr == null) continue;
          seen.set(Number(idxAttr), entry.intersectionRatio);
        }
        // Pick the slide with the highest intersection ratio.
        let best = activeIndex;
        let bestRatio = -1;
        for (const [idx, ratio] of seen) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = idx;
          }
        }
        if (best !== activeIndex && bestRatio >= 0.55) {
          setActiveIndex(best);
        }
      },
      {
        root: scroller,
        threshold: [0, 0.25, 0.55, 0.85, 1],
      },
    );

    for (const el of slideRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKeys.length]);

  // ── Bubble active index up ──────────────────────────────
  useEffect(() => {
    onActiveIndexChange?.(activeIndex);
  }, [activeIndex, onActiveIndexChange]);

  // ── Restore initial scroll position once on mount ───────
  useEffect(() => {
    if (restoredRef.current) return;
    if (slideRefs.current.size === 0) return;
    if (initialIndex <= 0) {
      restoredRef.current = true;
      return;
    }
    const target = slideRefs.current.get(initialIndex);
    if (target) {
      target.scrollIntoView({ behavior: "instant", block: "start" });
      setActiveIndex(initialIndex);
    }
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKeys.length]);

  // ── External restart: snap to slide 0 when the token changes ─
  useEffect(() => {
    if (restartToken === undefined) return;
    const target = slideRefs.current.get(0);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveIndex(0);
  }, [restartToken]);

  const slots = useMemo(() => itemKeys.map((_, i) => i), [itemKeys]);
  const slotsRefMap = slideRefs.current;

  return (
    <div ref={scrollerRef} className="catchup-scroller" data-testid="catchup-scroller">
      {/* Render children inside per-index wrappers. We expect exactly one child
          per item key and rely on order to bind them. */}
      {Array.isArray(children) ? (
        children.map((child, i) => (
          <div
            key={itemKeys[i] ?? i}
            data-slide-index={i}
            ref={(el) => {
              if (el) slotsRefMap.set(i, el);
              else slotsRefMap.delete(i);
            }}
            className="catchup-scroller-slide"
          >
            {child}
          </div>
        ))
      ) : (
        <div
          key={itemKeys[0] ?? 0}
          data-slide-index={0}
          ref={(el) => {
            if (el) slotsRefMap.set(0, el);
            else slotsRefMap.delete(0);
          }}
          className="catchup-scroller-slide"
        >
          {children}
        </div>
      )}
      {/* Touch slots so React knows we read it; harmless. */}
      <span className="hidden">{slots.length}</span>
    </div>
  );
}
