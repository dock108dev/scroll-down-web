"use client";

import type { PitchOutcome } from "./AnimationController";
import { OUTCOME_LABELS, OUTCOME_COLORS } from "./AnimationController";

interface OutcomeOverlayProps {
  outcome: PitchOutcome;
  probability: number;
  visible: boolean;
}

export function OutcomeOverlay({
  outcome,
  probability,
  visible,
}: OutcomeOverlayProps) {
  if (!visible) return null;

  const pct = Math.round(probability * 100);
  const color = OUTCOME_COLORS[outcome];

  return (
    <g>
      {/* Background pill */}
      <rect
        x="120"
        y="30"
        width="110"
        height="40"
        rx="8"
        fill="#171717"
        fillOpacity="0.9"
        stroke={color}
        strokeWidth="1"
        strokeOpacity="0.5"
      />
      {/* Outcome label */}
      <text
        x="175"
        y="48"
        textAnchor="middle"
        fill={color}
        fontSize="11"
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
      >
        {OUTCOME_LABELS[outcome]}
      </text>
      {/* Probability */}
      <text
        x="175"
        y="62"
        textAnchor="middle"
        fill="#737373"
        fontSize="9"
        fontFamily="system-ui, sans-serif"
      >
        {pct}% probability
      </text>
    </g>
  );
}
