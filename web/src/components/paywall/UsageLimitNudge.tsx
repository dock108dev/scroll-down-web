"use client";

import { useReveal } from "@/stores/reveal";
import { useEntitlement } from "@/entitlements/useEntitlement";
import { PAYWALL } from "@/lib/config";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

interface UsageCounterBadgeProps {
  className?: string;
}

export function UsageCounterBadge({ className }: UsageCounterBadgeProps) {
  const dailyRevealCount = useReveal((s) => s.dailyRevealCount);
  const { dailyRevealLimit, tier } = useEntitlement();

  if (tier === "pro") return null;

  const remaining = Math.max(0, dailyRevealLimit - dailyRevealCount);

  return (
    <span
      data-testid="usage-counter-badge"
      className={cn(
        "inline-flex items-center text-xs tabular-nums",
        remaining <= 1 ? "text-amber-400" : "text-neutral-500",
        className,
      )}
    >
      {remaining} of {PAYWALL.FREE_DAILY_REVEALS} reveals remaining today
    </span>
  );
}

interface LimitHitNudgeProps {
  onGoUnlimited: () => void;
  onDismiss: () => void;
}

export function LimitHitNudge({ onGoUnlimited, onDismiss }: LimitHitNudgeProps) {
  return (
    <div
      data-testid="limit-hit-nudge"
      className="rounded-lg border border-neutral-700/60 bg-neutral-900/80 p-5 space-y-4"
    >
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-neutral-200">
          You&apos;ve used all 5 free reveals today
        </p>
        <p className="text-xs text-neutral-400">
          Go unlimited for $0.99/month &mdash; that&apos;s $0.03/day.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          data-testid="limit-nudge-upgrade"
          onClick={() => {
            trackEvent("limit_nudge_upgrade_tap");
            onGoUnlimited();
          }}
          className={cn(
            "flex-1 py-2.5 min-h-[44px] rounded-lg",
            "bg-blue-600 text-white text-sm font-semibold",
            "hover:bg-blue-500 active:bg-blue-700 transition-colors",
          )}
        >
          Go Unlimited
        </button>
        <button
          data-testid="limit-nudge-dismiss"
          onClick={() => {
            trackEvent("limit_nudge_dismiss");
            onDismiss();
          }}
          className="text-sm text-neutral-500 hover:text-neutral-400 transition-colors py-2 px-3"
        >
          I&apos;ll wait
        </button>
      </div>
    </div>
  );
}
