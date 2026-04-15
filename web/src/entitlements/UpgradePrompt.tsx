"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

const FEATURE_LABELS: Record<string, string> = {
  canAccessFlow: "AI Game Flow",
  canAccessOdds: "Live Odds & Analytics",
  canAccessTimeline: "Play-by-Play Timeline",
  canAccessStats: "Advanced Stats",
  canAccessWrapUp: "Game Wrap-Up",
  canPinGames: "Pin Games",
};

export function UpgradePrompt({
  feature,
  message,
  preview,
  onUpgradeRequest,
}: {
  feature: string;
  message?: string;
  preview?: React.ReactNode;
  onUpgradeRequest?: () => void;
}) {
  const label = FEATURE_LABELS[feature] ?? feature;
  const displayMessage =
    message ?? `Upgrade to Pro to unlock ${label}`;

  return (
    <div data-testid="upgrade-prompt" className="relative">
      {preview && (
        <div aria-hidden="true" className="opacity-30 pointer-events-none">
          {preview}
        </div>
      )}
      <div
        className={`${preview ? "absolute inset-0 flex items-center justify-center" : ""} mx-auto max-w-md px-4 py-16 text-center space-y-4`}
      >
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/80 px-6 py-8 space-y-4 shadow-lg">
          <p className="text-sm text-neutral-300">{displayMessage}</p>
          {onUpgradeRequest ? (
            <button
              onClick={() => {
                trackEvent("upgrade_prompt_click", { feature });
                onUpgradeRequest();
              }}
              className="inline-block text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Upgrade to Pro
            </button>
          ) : (
            <Link
              href="/upgrade"
              onClick={() =>
                trackEvent("upgrade_prompt_click", { feature })
              }
              className="inline-block text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Upgrade to Pro
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
