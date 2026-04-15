"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { STORAGE_KEYS } from "@/lib/config";
import { useSettings } from "@/stores/settings";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = STORAGE_KEYS.ONBOARDING;

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.completed === true;
  } catch {
    return false;
  }
}

function markOnboardingCompleted() {
  try {
    localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ completed: true, completedAt: Date.now() }),
    );
  } catch {
    // storage denied — proceed anyway
  }
}

type Step = 1 | 2 | 3;

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const startedAtRef = useRef(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
    trackEvent("onboarding_start");
  }, []);

  const goToStep2 = useCallback(() => {
    trackEvent("onboarding_step", { step: 2 });
    setStep(2);
  }, []);

  const goToStep3 = useCallback(() => {
    trackEvent("onboarding_step", { step: 3 });
    setStep(3);
  }, []);

  const finish = useCallback(
    (mode: "always" | "onMarkRead" | "blacklist") => {
      const elapsed = Date.now() - startedAtRef.current;
      trackEvent("onboarding_complete", { mode, elapsed_ms: elapsed });
      markOnboardingCompleted();
      onComplete();
    },
    [onComplete],
  );

  return (
    <div
      data-testid="onboarding-flow"
      className="fixed inset-0 z-50 bg-neutral-950 flex items-center justify-center"
    >
      {step === 1 && <SplashStep onContinue={goToStep2} />}
      {step === 2 && <DemoStep onContinue={goToStep3} />}
      {step === 3 && <PreferenceStep onComplete={finish} />}
    </div>
  );
}

/* ── Step 1: Splash ─────────────────────────────────────────── */

function SplashStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      data-testid="onboarding-step-1"
      className="flex flex-col items-center justify-center px-8 text-center max-w-md"
    >
      <h1 className="text-3xl font-bold text-neutral-50 leading-tight">
        The best fans don&apos;t watch the scoreboard
      </h1>
      <p className="mt-4 text-base text-neutral-400 leading-relaxed">
        Follow games on your schedule, with scores shown only when you want
        them.
      </p>
      <button
        data-testid="onboarding-cta-1"
        onClick={onContinue}
        className="mt-10 px-8 py-3 min-h-[48px] rounded-full bg-blue-600 text-white font-semibold text-base hover:bg-blue-500 transition"
      >
        Show me
      </button>
    </div>
  );
}

/* ── Step 2: Interactive demo ───────────────────────────────── */

function DemoStep({ onContinue }: { onContinue: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    trackEvent("onboarding_demo_reveal");
    tooltipTimerRef.current = setTimeout(() => {
      onContinue();
    }, 2000);
  }, [onContinue]);

  return (
    <div
      data-testid="onboarding-step-2"
      className="flex flex-col items-center justify-center px-6 max-w-md w-full"
    >
      {/* Mock game card */}
      <div className="w-full rounded-[var(--ds-radius-game-card)] bg-neutral-800/40 border border-neutral-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            MLB
          </span>
          <span className="inline-flex items-center gap-1 text-green-400 font-semibold text-xs">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-live-dot absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
            LIVE
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[15px] font-semibold text-blue-400">
                Yankees
              </span>
              <span className="text-neutral-600 text-xs font-medium">@</span>
              <span className="text-[15px] font-semibold text-red-400">
                Red Sox
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Bot 6 &middot; Momentum shifting
            </p>
          </div>

          {/* Score zone — the interactive reveal */}
          {revealed ? (
            <div
              data-testid="onboarding-demo-score"
              className="shrink-0 ml-3 min-w-[96px] min-h-[44px] flex items-center justify-center animate-[score-reveal_300ms_ease-out]"
            >
              <span className="text-lg font-bold tabular-nums text-neutral-200">
                3 <span className="text-neutral-600">&ndash;</span> 2
              </span>
            </div>
          ) : (
            <button
              data-testid="onboarding-demo-reveal"
              onClick={handleReveal}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-neutral-800/40 border border-neutral-700/30 ml-3 text-blue-400 hover:text-blue-300 transition min-w-[96px] min-h-[44px] justify-center"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="text-xs font-medium">Reveal</span>
            </button>
          )}
        </div>
      </div>

      {/* Tooltip */}
      <div className="mt-6 text-center">
        {!revealed ? (
          <p
            data-testid="onboarding-tooltip-1"
            className="text-sm text-neutral-300 animate-[fade-in_400ms_ease-out]"
          >
            Tap to reveal the score
          </p>
        ) : (
          <p
            data-testid="onboarding-tooltip-2"
            className="text-sm text-neutral-300 animate-[fade-in_400ms_ease-out]"
          >
            Read the story first, reveal when you&apos;re ready
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Step 3: Preference selector ────────────────────────────── */

type RevealMode = "always" | "onMarkRead" | "blacklist";

const PREFERENCE_OPTIONS: {
  mode: RevealMode;
  label: string;
  description: string;
}[] = [
  {
    mode: "blacklist",
    label: "Always hide",
    description: "Scores stay hidden until you reveal them",
  },
  {
    mode: "onMarkRead",
    label: "Tap to reveal",
    description: "Hidden by default — tap any game to see the score",
  },
  {
    mode: "always",
    label: "Always show",
    description: "Traditional experience with scores always visible",
  },
];

function PreferenceStep({
  onComplete,
}: {
  onComplete: (mode: RevealMode) => void;
}) {
  const [selected, setSelected] = useState<RevealMode>("onMarkRead");
  const setScoreRevealMode = useSettings((s) => s.setScoreRevealMode);

  const handleSelect = useCallback(
    (mode: RevealMode) => {
      setSelected(mode);
      setScoreRevealMode(mode);
    },
    [setScoreRevealMode],
  );

  const handleFinish = useCallback(() => {
    setScoreRevealMode(selected);
    onComplete(selected);
  }, [selected, setScoreRevealMode, onComplete]);

  return (
    <div
      data-testid="onboarding-step-3"
      className="flex flex-col items-center justify-center px-6 max-w-md w-full"
    >
      <h2 className="text-xl font-bold text-neutral-50 mb-6">
        How do you watch?
      </h2>

      <div className="w-full space-y-3">
        {PREFERENCE_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            data-testid={`onboarding-pref-${opt.mode}`}
            onClick={() => handleSelect(opt.mode)}
            className={cn(
              "w-full text-left rounded-[var(--ds-radius-card)] border p-4 transition",
              selected === opt.mode
                ? "border-blue-500 bg-blue-600/10"
                : "border-neutral-700/40 bg-neutral-800/30 hover:border-neutral-600",
            )}
          >
            <span
              className={cn(
                "block text-base font-semibold",
                selected === opt.mode
                  ? "text-blue-400"
                  : "text-neutral-200",
              )}
            >
              {opt.label}
            </span>
            <span className="block text-sm text-neutral-400 mt-1">
              {opt.description}
            </span>
          </button>
        ))}
      </div>

      <button
        data-testid="onboarding-cta-finish"
        onClick={handleFinish}
        className="mt-8 px-8 py-3 min-h-[48px] rounded-full bg-blue-600 text-white font-semibold text-base hover:bg-blue-500 transition"
      >
        Let&apos;s go
      </button>
    </div>
  );
}
