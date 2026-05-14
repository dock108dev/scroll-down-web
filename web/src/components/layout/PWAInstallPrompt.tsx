"use client";

import { useEffect, useRef, useState } from "react";
import { PWA, STORAGE_KEYS } from "@/lib/config";
import { useClaimTopBannerSlot } from "@/lib/top-banner-slot";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneMode(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

function readDismissed(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEYS.PWA_INSTALL_DISMISSED);
  } catch {
    return false;
  }
}

function incrementSessionCount(): number {
  try {
    const next = parseInt(localStorage.getItem(STORAGE_KEYS.PWA_SESSION_COUNT) ?? "0", 10) + 1;
    localStorage.setItem(STORAGE_KEYS.PWA_SESSION_COUNT, String(next));
    return next;
  } catch {
    return 0;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PWA_INSTALL_DISMISSED, "1");
  } catch {
    // ignore write failures
  }
}

export function PWAInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  useClaimTopBannerSlot("pwa-install", visible);

  useEffect(() => {
    if (isStandaloneMode() || readDismissed()) return;

    const sessionCount = incrementSessionCount();

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      if (sessionCount >= PWA.INSTALL_MIN_SESSIONS) {
        setVisible(true);
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstall() {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // Persist regardless of outcome — once the native dialog shows, don't prompt again
    persistDismissed();
    setVisible(false);
    deferredPromptRef.current = null;
  }

  function handleDismiss() {
    persistDismissed();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label="Install app"
      data-testid="pwa-install-prompt"
      className="w-full bg-neutral-900 border-b border-neutral-800 pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-neutral-300 max-w-2xl">
        <span className="min-w-0 flex-1">
          <span className="sm:hidden">Add to home screen</span>
          <span className="hidden sm:inline">Add Scroll Down Sports to your home screen for a faster experience.</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors"
            aria-label="Dismiss install prompt"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
