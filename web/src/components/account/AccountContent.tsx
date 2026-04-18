"use client";

import { useEffect, useState } from "react";
import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { FEATURE_GATES } from "@/lib/config";

interface BillingInfo {
  email: string;
  tier: "free" | "pro";
  nextBillingDate: string | null;
}

function formatBillingDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function AccountContent({ email }: { email: string | null }) {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const openSheet = useProGateSheet((s) => s.openSheet);

  useEffect(() => {
    fetch("/api/billing/info", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BillingInfo | null) => setInfo(data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);

  const tier = info?.tier ?? "free";
  const nextBillingDate = info?.nextBillingDate ?? null;
  const displayEmail = info?.email ?? email;

  return (
    <div data-testid="account-content" className="space-y-6">
      {/* Email */}
      {displayEmail && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
            Account
          </p>
          <p className="text-sm text-neutral-200" data-testid="account-email">
            {displayEmail}
          </p>
        </div>
      )}

      {/* Plan */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Subscription
        </p>

        {loading ? (
          <div className="h-5 w-24 rounded bg-neutral-800 animate-pulse" />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span
                className="text-lg font-bold text-neutral-100"
                data-testid="account-plan-label"
              >
                {tier === "pro" ? "Pro" : "Free"}
              </span>
              {tier === "pro" && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400">
                  Active
                </span>
              )}
            </div>

            {tier === "pro" ? (
              <div className="space-y-4">
                {nextBillingDate && (
                  <p className="text-sm text-neutral-400" data-testid="account-billing-date">
                    Renews{" "}
                    <span className="text-neutral-200">
                      {formatBillingDate(nextBillingDate)}
                    </span>
                  </p>
                )}
                <a
                  href="/api/billing/portal"
                  className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: "var(--color-neutral-800, #262626)", color: "var(--color-neutral-100, #f5f5f5)" }}
                  data-testid="manage-subscription-btn"
                >
                  Manage Subscription
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-neutral-400">
                  Upgrade for full FairBet access, all sportsbooks, live odds, and more.
                </p>
                <button
                  onClick={() => openSheet(FEATURE_GATES.FULL_FAIRBET, null)}
                  className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: "#2563eb", color: "#fff" }}
                  data-testid="account-upgrade-cta"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
