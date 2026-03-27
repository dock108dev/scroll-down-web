"use client";

import { useState } from "react";

const DISMISSED_KEY = "sd-beta-banner-dismissed";

function wasNotDismissed(): boolean {
  try {
    return !localStorage.getItem(DISMISSED_KEY);
  } catch {
    return false; // SSR or storage unavailable
  }
}

export function BetaBanner() {
  const [visible, setVisible] = useState(wasNotDismissed);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full bg-blue-500/10 border-b border-blue-500/20">
      <div className="mx-auto flex items-center justify-center gap-2 px-4 py-1.5 text-xs text-neutral-300">
        <span className="inline-flex items-center rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
          Beta
        </span>
        <span>
          Early version &mdash; some features are in progress.{" "}
          <a
            href="mailto:support@scrolldownsports.dev?subject=Beta Feedback"
            className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Send feedback
          </a>
        </span>
        <button
          onClick={dismiss}
          className="ml-2 shrink-0 p-0.5 text-neutral-500 hover:text-neutral-300 transition-colors"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
