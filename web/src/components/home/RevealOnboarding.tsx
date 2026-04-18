"use client";

import { useState } from "react";
import { STORAGE_KEYS } from "@/lib/config";

const STEPS = [
  "Scores are hidden — tap a game to reveal when you're ready.",
  "Your reveals are saved. Come back anytime without seeing spoilers.",
] as const;

function shouldShowBanner(): boolean {
  if (localStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN)) return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.READ_STATE);
    if (raw) {
      const ids = JSON.parse(raw)?.state?.revealedIds;
      if (Array.isArray(ids) && ids.length > 0) return false;
    }
  } catch {
    // ignore parse errors
  }
  return true;
}

export function RevealOnboarding() {
  // Lazy initializer: runs client-side only (component loaded with ssr:false).
  const [visible, setVisible] = useState(() => shouldShowBanner());
  const [step, setStep] = useState<0 | 1>(0);

  if (!visible) return null;

  const handleAction = () => {
    if (step === 0) {
      setStep(1);
    } else {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, "1");
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
