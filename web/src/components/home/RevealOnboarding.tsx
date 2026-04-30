"use client";

import { useState } from "react";
import { STORAGE_KEYS } from "@/lib/config";
import { useReveal } from "@/stores/reveal";
import { HOME_COPY } from "./copy";

const STEPS = HOME_COPY.onboarding;

function hasSeenOnboarding(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN);
  } catch {
    return false;
  }
}

export function RevealOnboarding() {
  const isHydrated = useReveal((s) => s.isHydrated);
  const revealedCount = useReveal((s) => s.revealedIds.size);

  const [visible, setVisible] = useState<boolean | null>(null);
  const [step, setStep] = useState<0 | 1>(0);

  // Defer visibility decision until IDB hydration completes so we don't flash
  // the banner for users who already have reveals in IndexedDB.
  if (!isHydrated) return null;

  const shouldShow =
    visible !== null
      ? visible
      : !hasSeenOnboarding() && revealedCount === 0;

  if (!shouldShow) return null;

  const handleAction = () => {
    if (step === 0) {
      setStep(1);
    } else {
      try {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, "1");
      } catch { /* storage denied — onboarding will reappear next session */ }
      setVisible(false);
    }
  };

  return (
    <div
      data-testid="reveal-onboarding"
      className="mx-4 mt-3 mb-1 rounded-lg border border-blue-800/60 bg-blue-950/40 px-4 py-3 flex items-start gap-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-200 leading-snug">{STEPS[step]}</p>
        <div className="mt-1.5 flex items-center gap-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
                i === step ? "bg-blue-400" : "bg-neutral-600"
              }`}
            />
          ))}
        </div>
      </div>
      <button
        data-testid="reveal-onboarding-dismiss"
        onClick={handleAction}
        className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition"
      >
        {step === 0 ? "Next" : "Got it"}
      </button>
    </div>
  );
}
