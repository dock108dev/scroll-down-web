"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationPhase } from "./AnimationController";

interface BallAnimationProps {
  phase: AnimationPhase;
  inZone: boolean;
  foulTrajectory: boolean;
  inPlayTrajectory: boolean;
}

// Quadratic bezier interpolation
function quadBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
): number {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

export function BallAnimation({
  phase,
  inZone,
  foulTrajectory,
  inPlayTrajectory,
}: BallAnimationProps) {
  const [pos, setPos] = useState({ x: 95, y: 82 });
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  // Pitch path: mound to plate
  const startX = 95;
  const startY = 82;
  const endX = inZone ? 258 : 258;
  const endY = inZone ? 90 : 78; // out of zone = high/outside
  const cpX = 175;
  const cpY = inZone ? 70 : 60; // arc control point

  useEffect(() => {
    if (phase === "travel") {
      setVisible(true);
      startRef.current = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startRef.current;
        const t = Math.min(elapsed / 600, 1); // 600ms travel
        const eased = t * t * (3 - 2 * t); // smoothstep

        setPos({
          x: quadBezier(eased, startX, cpX, endX),
          y: quadBezier(eased, startY, cpY, endY),
        });

        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rafRef.current);
    }

    if (phase === "result") {
      // Post-contact trajectory
      if (foulTrajectory) {
        // Foul ball pops up and back
        startRef.current = performance.now();
        const animate = (now: number) => {
          const elapsed = now - startRef.current;
          const t = Math.min(elapsed / 400, 1);
          setPos({
            x: 258 + t * 30,
            y: 90 - t * 60,
          });
          if (t < 1) rafRef.current = requestAnimationFrame(animate);
          else setVisible(false);
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
      }

      if (inPlayTrajectory) {
        // Ball hit into field — travels forward and up
        startRef.current = performance.now();
        const animate = (now: number) => {
          const elapsed = now - startRef.current;
          const t = Math.min(elapsed / 500, 1);
          setPos({
            x: 258 - t * 100,
            y: 90 - t * 50,
          });
          if (t < 1) rafRef.current = requestAnimationFrame(animate);
          else setVisible(false);
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
      }

      return;
    }

    if (phase === "idle") {
      setVisible(false);
      setPos({ x: startX, y: startY });
    }
  }, [phase, inZone, foulTrajectory, inPlayTrajectory, startX, cpX, cpY, endX, endY]);

  if (!visible) return null;

  return (
    <circle
      cx={pos.x}
      cy={pos.y}
      r="4"
      fill="#fafafa"
      stroke="#737373"
      strokeWidth="0.5"
      style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.4))" }}
    />
  );
}
