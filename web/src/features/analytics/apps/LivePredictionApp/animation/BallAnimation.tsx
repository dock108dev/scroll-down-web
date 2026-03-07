"use client";

import { useEffect, useRef, useCallback } from "react";
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
  const circleRef = useRef<SVGCircleElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  // Pitch path: mound to plate
  const startX = 95;
  const startY = 82;
  const endX = 258;
  const endY = inZone ? 90 : 78;
  const cpX = 175;
  const cpY = inZone ? 70 : 60;

  const setCirclePos = useCallback((x: number, y: number) => {
    const el = circleRef.current;
    if (!el) return;
    el.setAttribute("cx", String(x));
    el.setAttribute("cy", String(y));
  }, []);

  const show = useCallback(() => {
    circleRef.current?.setAttribute("visibility", "visible");
  }, []);

  const hideEl = useCallback(() => {
    circleRef.current?.setAttribute("visibility", "hidden");
  }, []);

  useEffect(() => {
    if (phase === "travel") {
      show();
      startRef.current = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startRef.current;
        const t = Math.min(elapsed / 600, 1);
        const eased = t * t * (3 - 2 * t);

        setCirclePos(
          quadBezier(eased, startX, cpX, endX),
          quadBezier(eased, startY, cpY, endY),
        );

        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rafRef.current);
    }

    if (phase === "result") {
      if (foulTrajectory) {
        startRef.current = performance.now();
        const animate = (now: number) => {
          const elapsed = now - startRef.current;
          const t = Math.min(elapsed / 400, 1);
          setCirclePos(258 + t * 30, 90 - t * 60);
          if (t < 1) rafRef.current = requestAnimationFrame(animate);
          else hideEl();
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
      }

      if (inPlayTrajectory) {
        startRef.current = performance.now();
        const animate = (now: number) => {
          const elapsed = now - startRef.current;
          const t = Math.min(elapsed / 500, 1);
          setCirclePos(258 - t * 100, 90 - t * 50);
          if (t < 1) rafRef.current = requestAnimationFrame(animate);
          else hideEl();
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
      }

      return;
    }

    if (phase === "idle") {
      hideEl();
      setCirclePos(startX, startY);
    }
  }, [phase, inZone, foulTrajectory, inPlayTrajectory, startX, cpX, cpY, endX, endY, show, hideEl, setCirclePos]);

  return (
    <circle
      ref={circleRef}
      cx={startX}
      cy={startY}
      r="4"
      fill="#fafafa"
      stroke="#737373"
      strokeWidth="0.5"
      visibility="hidden"
      style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.4))" }}
    />
  );
}
