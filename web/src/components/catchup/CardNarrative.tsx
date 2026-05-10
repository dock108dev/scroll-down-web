"use client";

import type { CSSProperties } from "react";
import {
  NARRATIVE_TYPOGRAPHY_CLASS,
  type LeverageTier,
} from "@/lib/leverage";

interface CardNarrativeProps {
  text: string;
  /** Skips the entry animation when reduced motion is preferred. */
  isActive: boolean;
  /** Pacing tier — drives typography weight. */
  leverage?: LeverageTier;
  /** Reveal-fade duration (ms) — exposed as `--narrative-reveal-dur`. */
  revealDur?: number;
}

/**
 * Single-paragraph play description with a fade/translate entry. Triggered
 * by the parent flipping `isActive` once the card is in view.
 */
export function CardNarrative({
  text,
  isActive,
  leverage = 0,
  revealDur,
}: CardNarrativeProps) {
  const style =
    revealDur !== undefined
      ? ({ ["--narrative-reveal-dur"]: `${revealDur}ms` } as CSSProperties)
      : undefined;
  return (
    <p
      data-active={isActive ? "true" : "false"}
      data-leverage={leverage}
      style={style}
      className={`catchup-narrative text-neutral-100 ${NARRATIVE_TYPOGRAPHY_CLASS[leverage]}`}
    >
      {text}
    </p>
  );
}
