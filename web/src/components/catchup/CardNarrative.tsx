"use client";

interface CardNarrativeProps {
  text: string;
  /** Skips the entry animation when reduced motion is preferred. */
  isActive: boolean;
}

/**
 * Single-paragraph play description with a fade/translate entry. Triggered
 * by the parent flipping `isActive` once the card is in view.
 */
export function CardNarrative({ text, isActive }: CardNarrativeProps) {
  return (
    <p
      data-active={isActive ? "true" : "false"}
      className="catchup-narrative text-base leading-relaxed text-neutral-100 sm:text-lg"
    >
      {text}
    </p>
  );
}
