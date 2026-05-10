"use client";

interface CatchupProgressProps {
  total: number;
  currentIndex: number;
  isFinal: boolean;
}

/**
 * Slim progress rail at the top of the scroll container. Dots for short decks,
 * a thin progress bar for longer ones. Doesn't show absolute counts (which
 * could nudge the user toward "almost done — what's the score" thinking).
 */
export function CatchupProgress({ total, currentIndex, isFinal }: CatchupProgressProps) {
  const safeTotal = Math.max(1, total);
  const pct = Math.min(100, Math.max(0, ((currentIndex + 1) / safeTotal) * 100));
  return (
    <div className="catchup-progress" aria-hidden>
      <div className="catchup-progress-bar" style={{ width: `${pct}%` }} />
      {!isFinal && (
        <span className="catchup-progress-live">
          <span className="catchup-progress-live-dot" />
          Live
        </span>
      )}
    </div>
  );
}
