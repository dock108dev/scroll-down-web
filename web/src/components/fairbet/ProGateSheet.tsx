"use client";

import { useEffect, useLayoutEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { useSession } from "@/stores/session";
import type { FeatureGateKey } from "@/lib/config";

const FEATURE_COPY: Record<FeatureGateKey, { title: string; benefit: string }> = {
  live_odds: {
    title: "Live In-Game Odds",
    benefit: "See odds update in real time as plays happen — never miss a line move.",
  },
  full_fairbet: {
    title: "Full FairBet Analysis",
    benefit: "Get the complete expected-value breakdown across all available markets.",
  },
  all_books: {
    title: "All Sportsbooks",
    benefit: "Compare lines from every book we track to find the best number.",
  },
  all_markets: {
    title: "All Markets",
    benefit: "Unlock player props, alternate lines, and futures alongside the main lines.",
  },
  cross_device_sync: {
    title: "Cross-Device Sync",
    benefit: "Your reveal state and preferences stay in sync across all your devices.",
  },
  advanced_filters: {
    title: "Advanced Filters",
    benefit: "Filter by league, team, bet type, and EV threshold — your feed, your rules.",
  },
  line_movement: {
    title: "Line Movement",
    benefit: "See the opening line vs. current price so you know whether the market moved in your favor.",
  },
  ev_simulator: {
    title: "EV Simulator",
    benefit: "Enter any stake and see your projected profit per bet and over 100 bets based on the fair-value edge.",
  },
  clv_tracking: {
    title: "CLV Tracking",
    benefit: "Log your bets and compare placed odds against the closing line to see if you're consistently finding value.",
  },
  win_probability: {
    title: "Win Probability Simulator",
    benefit: "Run 10,000 simulations per game to see projected win%, spread cover%, over/under%, and a margin-of-victory distribution — all in seconds.",
  },
  history: {
    title: "Game History Archive",
    benefit: "Browse every completed game by date, search by team, and review past matchups — your full archive, always available.",
  },
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function startCheckout(plan: "monthly" | "annual"): Promise<void> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    throw new Error(`Checkout failed: ${res.status}`);
  }
  const data = (await res.json()) as { url?: string };
  if (data.url) {
    window.location.href = data.url;
  }
}

export function ProGateSheet() {
  const { open, feature, triggerEl, closeSheet, openSheet } = useProGateSheet();
  const { status } = useSession();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const isLoggedOut = status === "anonymous";
  const copy = feature ? FEATURE_COPY[feature] : null;

  async function handleUpgrade() {
    if (isLoggedOut) {
      window.location.href = "/login";
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      await startCheckout("monthly");
    } catch {
      setCheckoutLoading(false);
      setCheckoutError("Could not start checkout. Please try again.");
    }
  }

  // Expose openSheet on window for E2E test access (layout phase so Playwright does not race useEffect)
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as Record<string, unknown>).__openProGateSheet = openSheet;
    return () => {
      delete (window as unknown as Record<string, unknown>).__openProGateSheet;
    };
  }, [openSheet]);

  const handleClose = useCallback(() => {
    closeSheet();
    setCheckoutLoading(false);
    setCheckoutError(null);
  }, [closeSheet]);

  // Focus trap + Escape key
  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(dialog!.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  // Return focus to trigger element when sheet closes
  useEffect(() => {
    if (!open && triggerEl) {
      triggerEl.focus();
    }
  }, [open, triggerEl]);

  if (!open || !copy) return null;

  return (
    <>
      {/* Backdrop — z-[60] sits above BottomTabs (z-50) so mobile tabs aren't
          tappable while the sheet is open. */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={handleClose}
        aria-hidden="true"
        data-testid="pro-gate-backdrop"
      />

      {/* Sheet (mobile) / Modal (desktop).
          On mobile `bottom-16` lifts the sheet above the 64px BottomTabs so the
          Upgrade CTA isn't crowded against the tab bar. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Upgrade to Pro — ${copy.title}`}
        data-testid="pro-gate-sheet"
        className="
          fixed z-[70] flex flex-col gap-5
          bottom-16 left-0 right-0
          md:bottom-auto md:left-1/2 md:top-1/2
          md:-translate-x-1/2 md:-translate-y-1/2
          md:w-full md:max-w-md
          border rounded-t-2xl md:rounded-2xl
          shadow-2xl p-6
        "
        style={{
          background: "var(--color-neutral-900, #171717)",
          borderColor: "var(--color-neutral-800, #262626)",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--color-neutral-400, #a3a3a3)" }}
              data-testid="pro-gate-label"
            >
              Pro Feature
            </span>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--color-neutral-50, #fafafa)" }}
              data-testid="pro-gate-title"
            >
              {copy.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg flex items-center justify-center hover:bg-neutral-800 active:bg-neutral-700 transition-colors"
            style={{
              width: "44px",
              height: "44px",
              color: "var(--color-neutral-300, #d4d4d4)",
            }}
            aria-label="Close upgrade prompt"
            data-testid="pro-gate-close"
          >
            <svg
              width="20"
              height="20"
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

        {/* Benefit copy */}
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-neutral-300, #d4d4d4)" }}
          data-testid="pro-gate-benefit"
        >
          {copy.benefit}
        </p>

        {/* Pricing */}
        <div
          className="rounded-xl p-4 flex flex-col gap-1.5 border"
          style={{
            background: "var(--color-neutral-800, #262626)",
            borderColor: "var(--color-neutral-700, #404040)",
          }}
        >
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-2xl font-bold"
              style={{ color: "var(--color-neutral-50, #fafafa)" }}
              data-testid="pro-gate-price-monthly"
            >
              $0.99
            </span>
            <span
              className="text-sm"
              style={{ color: "var(--color-neutral-400, #a3a3a3)" }}
            >
              / month
            </span>
          </div>
          <p
            className="text-xs"
            style={{ color: "var(--color-neutral-400, #a3a3a3)" }}
            data-testid="pro-gate-price-annual"
          >
            or $8 / year — save 33%
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          {checkoutError && (
            <p
              className="text-xs text-center"
              style={{ color: "var(--color-red-400, #f87171)" }}
              data-testid="pro-gate-checkout-error"
            >
              {checkoutError}
            </p>
          )}
          <button
            className="w-full py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
            style={{ background: "#2563eb", color: "#fff" }}
            data-testid="pro-gate-upgrade-cta"
            onClick={handleUpgrade}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? "Redirecting…" : "Upgrade to Pro"}
          </button>

          {isLoggedOut && (
            <Link
              href="/login"
              className="w-full py-3 rounded-xl border font-medium text-sm text-center block transition-colors"
              style={{
                borderColor: "var(--color-neutral-700, #404040)",
                color: "var(--color-neutral-300, #d4d4d4)",
              }}
              data-testid="pro-gate-login-cta"
              onClick={handleClose}
            >
              Create free account
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
