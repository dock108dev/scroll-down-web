"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PitchProbabilities } from "../../../types";
import {
  sampleOutcome,
  getOutcomeInfo,
  TIMING,
  type AnimationPhase,
  type PitchOutcome,
} from "./AnimationController";
import { PitcherSilhouette } from "./PitcherSilhouette";
import { BatterSilhouette } from "./BatterSilhouette";
import { BallAnimation } from "./BallAnimation";
import { OutcomeOverlay } from "./OutcomeOverlay";

interface MatchupAnimationProps {
  probabilities: PitchProbabilities;
  onResult?: (outcome: PitchOutcome) => void;
  disabled?: boolean;
}

export function MatchupAnimation({
  probabilities,
  onResult,
  disabled,
}: MatchupAnimationProps) {
  const [phase, setPhase] = useState<AnimationPhase>("idle");
  const [outcome, setOutcome] = useState<PitchOutcome | null>(null);
  const [swinging, setSwinging] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [animating, setAnimating] = useState(false);

  const clearTimers = useCallback(() => {
    for (const t of timerRefs.current) clearTimeout(t);
    timerRefs.current = [];
  }, []);

  const scheduleTimer = useCallback(
    (fn: () => void, delay: number) => {
      const t = setTimeout(fn, delay);
      timerRefs.current.push(t);
      return t;
    },
    [],
  );

  const simulatePitch = useCallback(() => {
    if (animating) return;

    clearTimers();
    setAnimating(true);
    setShowOverlay(false);
    setSwinging(false);

    const selected = sampleOutcome(probabilities);
    const info = getOutcomeInfo(selected);
    setOutcome(selected);

    // Windup
    setPhase("windup");

    // Release + travel
    scheduleTimer(() => {
      setPhase("release");
    }, TIMING.RELEASE);

    scheduleTimer(() => {
      setPhase("travel");
    }, TIMING.TRAVEL_START);

    // Swing (if applicable)
    if (info.batterSwings) {
      scheduleTimer(() => {
        setSwinging(true);
      }, TIMING.SWING_START);
    }

    // Result
    scheduleTimer(() => {
      setPhase("result");
      setShowOverlay(true);
      onResult?.(selected);
    }, TIMING.RESULT_SHOW);

    // Reset to idle
    scheduleTimer(() => {
      setAnimating(false);
      setPhase("idle");
      setSwinging(false);
      setShowOverlay(false);
    }, TIMING.TOTAL);
  }, [probabilities, animating, onResult, clearTimers, scheduleTimer]);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  const outcomeInfo = outcome ? getOutcomeInfo(outcome) : null;

  return (
    <div className="space-y-3">
      {/* SVG Scene */}
      <div className="card overflow-hidden">
        <svg
          viewBox="0 0 350 140"
          className="w-full"
          style={{ maxHeight: 180 }}
        >
          {/* Field background */}
          <rect width="350" height="140" fill="#171717" />

          {/* Diamond outline */}
          <polygon
            points="175,15 310,75 175,135 40,75"
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="1"
          />

          {/* Mound circle */}
          <circle
            cx="80"
            cy="95"
            r="12"
            fill="none"
            stroke="#333"
            strokeWidth="0.5"
          />
          <circle cx="80" cy="95" r="2" fill="#555" />

          {/* Home plate */}
          <polygon
            points="258,88 264,93 264,97 252,97 252,93"
            fill="#555"
            stroke="#666"
            strokeWidth="0.5"
          />

          {/* Strike zone (faint) */}
          <rect
            x="254"
            y="78"
            width="14"
            height="22"
            fill="none"
            stroke="#333"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />

          {/* Pitcher */}
          <PitcherSilhouette phase={phase} />

          {/* Batter */}
          <BatterSilhouette swinging={swinging} />

          {/* Ball */}
          <BallAnimation
            phase={phase}
            inZone={outcomeInfo?.ballInZone ?? true}
            foulTrajectory={outcome === "foul"}
            inPlayTrajectory={outcome === "in_play"}
          />

          {/* Outcome overlay */}
          {outcome && (
            <OutcomeOverlay
              outcome={outcome}
              probability={probabilities[outcome]}
              visible={showOverlay}
            />
          )}
        </svg>
      </div>

      {/* Simulate button */}
      <button
        onClick={simulatePitch}
        disabled={disabled || animating}
        className={
          "w-full py-2.5 rounded text-sm font-medium transition-colors " +
          (disabled || animating
            ? "bg-neutral-800 text-neutral-600 cursor-not-allowed"
            : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600 active:bg-neutral-500")
        }
      >
        {animating ? "Simulating..." : "Simulate Pitch"}
      </button>
    </div>
  );
}
