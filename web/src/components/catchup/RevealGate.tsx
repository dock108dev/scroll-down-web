"use client";

import { useState } from "react";

interface RevealGateProps {
  awayTeam: string;
  homeTeam: string;
  /** Fired when the user explicitly asks to see the final score. */
  onReveal: () => void;
  /** True when the active slide is the gate. Triggers the entry animation. */
  isActive: boolean;
}

/**
 * Full-viewport "ready for the final?" prompt that lives at the end of the
 * deck. Doesn't fetch the summary itself — just hands control back to the
 * orchestrator once the user taps reveal.
 */
export function RevealGate({ awayTeam, homeTeam, onReveal, isActive }: RevealGateProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <section
      data-testid="reveal-gate"
      data-active={isActive ? "true" : "false"}
      className="reveal-gate"
    >
      <div className="reveal-gate-stadium" aria-hidden />
      <div className="reveal-gate-inner">
        <p className="catchup-eyebrow">You&rsquo;re caught up</p>
        <h2 className="reveal-gate-headline">Ready for the final score?</h2>
        <p className="reveal-gate-sub">
          {awayTeam} at {homeTeam}. Tap below to see the result and the recap.
        </p>
        <button
          data-testid="reveal-button"
          onClick={() => {
            setPressed(true);
            onReveal();
          }}
          disabled={pressed}
          className="reveal-gate-button"
        >
          {pressed ? "Revealing…" : "Reveal final score"}
        </button>
      </div>
    </section>
  );
}
