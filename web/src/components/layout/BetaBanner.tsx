"use client";

import { useState, useEffect } from "react";

const DISMISSED_KEY = "sd-beta-banner-dismissed";

export function BetaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(DISMISSED_KEY)) {
        setVisible(true);
      }
    } catch {
      // SSR or storage unavailable
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:bottom-4 md:left-auto md:right-4 md:max-w-sm pointer-events-none">
      <div className="pointer-events-auto mx-4 mb-[calc(4.5rem+env(safe-area-inset-bottom))] md:mx-0 md:mb-0 rounded-lg border border-blue-500/20 bg-neutral-900/95 backdrop-blur px-4 py-3 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
            Beta
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-300 leading-relaxed">
              You&apos;re using an early version of Scroll Down Sports. Some
              features are still in progress. Found a bug or have feedback?
            </p>
            <a
              href="mailto:support@scrolldownsports.dev?subject=Beta Feedback"
              className="mt-1.5 inline-block text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Send feedback
            </a>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
