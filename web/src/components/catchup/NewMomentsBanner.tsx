"use client";

/**
 * Non-modal banner shown when polling has observed a newer deck version
 * but the visible deck has NOT been swapped yet.
 *
 * The banner is the user's gate to opt into the new content — clicking
 * "Update deck" applies the pending deck. Until then, the visible cards
 * (and the user's scroll position) stay put.
 *
 * Intentionally small and quiet. This is not a modal; it should not
 * cover the field or interrupt scrolling.
 */
interface NewMomentsBannerProps {
  /** Whether a newer deck is pending. Hidden when false. */
  visible: boolean;
  /** Click handler — applies the pending deck. */
  onApply: () => void;
}

export function NewMomentsBanner({ visible, onApply }: NewMomentsBannerProps) {
  if (!visible) return null;
  return (
    <div
      data-testid="new-moments-banner"
      role="status"
      aria-live="polite"
      className="new-moments-banner"
    >
      <span className="new-moments-banner-text">New moments available</span>
      <button
        type="button"
        onClick={onApply}
        className="new-moments-banner-button"
      >
        Update deck
      </button>
    </div>
  );
}
