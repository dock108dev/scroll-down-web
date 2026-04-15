"use client";

import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { usePaywall, type PaywallTrigger } from "@/stores/paywall";

const FEATURES = [
  "Unlimited score reveals",
  "Odds & FairBet access",
  "Pin your favorite games",
  "Priority Flow updates",
] as const;

interface PaywallModalProps {
  trigger: PaywallTrigger;
  onClose: () => void;
  onSubscribe?: () => void;
}

export function PaywallModal({
  trigger,
  onClose,
  onSubscribe,
}: PaywallModalProps) {
  const dismiss = usePaywall((s) => s.dismiss);
  const markPostRevealPaywallSeen = usePaywall(
    (s) => s.markPostRevealPaywallSeen,
  );

  useEffect(() => {
    trackEvent("paywall_view", { trigger });
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [trigger]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const handleDismiss = useCallback(() => {
    dismiss();
    if (trigger === "post_first_reveal") {
      markPostRevealPaywallSeen();
    }
    onClose();
  }, [dismiss, markPostRevealPaywallSeen, trigger, onClose]);

  const handleSubscribe = useCallback(() => {
    trackEvent("paywall_subscribe_tap", { trigger });
    onSubscribe?.();
  }, [trigger, onSubscribe]);

  return (
    <div
      data-testid="paywall-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Subscribe to Pro"
    >
      <div className="relative flex flex-col items-center px-8 py-12 max-w-sm w-full text-center">
        {/* Brand */}
        <h1 className="text-2xl font-bold text-neutral-50 leading-tight">
          Scroll Down Sports
        </h1>
        <p className="text-sm text-blue-400 font-medium mt-1">Pro</p>

        {/* Pitch */}
        <p className="mt-8 text-base text-neutral-200 leading-relaxed">
          Score-safe sports following, unlimited. $0.03/day.
        </p>

        {/* Feature list */}
        <ul className="mt-8 space-y-3 w-full text-left">
          {FEATURES.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-3 text-sm text-neutral-300"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0 text-blue-400"
              >
                <path
                  d="M3 8.5L6.5 12L13 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {feature}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          data-testid="paywall-subscribe-btn"
          onClick={handleSubscribe}
          className={cn(
            "mt-10 w-full py-3.5 min-h-[48px] rounded-full",
            "bg-blue-600 text-white font-semibold text-base",
            "hover:bg-blue-500 active:bg-blue-700 transition-colors",
          )}
        >
          Subscribe &mdash; $0.99/month
        </button>

        {/* Maybe later */}
        <button
          data-testid="paywall-dismiss-btn"
          onClick={handleDismiss}
          className="mt-4 text-sm text-neutral-500 hover:text-neutral-400 transition-colors py-2"
        >
          Maybe later
        </button>

        {/* Footer */}
        <div className="mt-8 text-xs text-neutral-600 space-y-1">
          <p>Cancel anytime &middot; Restore purchase</p>
          <p>
            <a href="/terms" className="underline hover:text-neutral-500">
              Terms of Service
            </a>
            {" & "}
            <a href="/privacy" className="underline hover:text-neutral-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
