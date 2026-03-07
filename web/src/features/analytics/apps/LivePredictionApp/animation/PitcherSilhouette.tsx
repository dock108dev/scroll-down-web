"use client";

import type { AnimationPhase } from "./AnimationController";

interface PitcherSilhouetteProps {
  phase: AnimationPhase;
}

export function PitcherSilhouette({ phase }: PitcherSilhouetteProps) {
  return (
    <g
      className={
        phase === "windup"
          ? "animate-pitcher-windup"
          : phase === "release"
            ? "animate-pitcher-release"
            : ""
      }
    >
      {/* Body */}
      <ellipse cx="80" cy="115" rx="10" ry="5" fill="#404040" opacity="0.3" />
      {/* Legs */}
      <line
        x1="76"
        y1="105"
        x2="72"
        y2="115"
        stroke="#d4d4d4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="84"
        y1="105"
        x2="88"
        y2="115"
        stroke="#d4d4d4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Torso */}
      <line
        x1="80"
        y1="85"
        x2="80"
        y2="105"
        stroke="#d4d4d4"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Head */}
      <circle cx="80" cy="78" r="7" fill="#d4d4d4" />
      {/* Throwing arm */}
      <line
        x1="80"
        y1="88"
        x2={phase === "windup" ? "68" : phase === "release" ? "95" : "90"}
        y2={phase === "windup" ? "72" : phase === "release" ? "82" : "80"}
        stroke="#d4d4d4"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ transition: "all 200ms ease-out" }}
      />
      {/* Glove arm */}
      <line
        x1="80"
        y1="88"
        x2="68"
        y2="95"
        stroke="#d4d4d4"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}
