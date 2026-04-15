"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useReveal } from "@/stores/reveal";
import { useEntitlement } from "@/entitlements/useEntitlement";
import { usePaywall, type PaywallTrigger } from "@/stores/paywall";

interface PaywallTriggerState {
  showPaywall: boolean;
  showLimitNudge: boolean;
  activeTrigger: PaywallTrigger | null;
  openPaywall: (trigger: PaywallTrigger) => void;
  closePaywall: () => void;
  dismissLimitNudge: () => void;
  remainingReveals: number;
  isAtLimit: boolean;
}

export function usePaywallTrigger(): PaywallTriggerState {
  const { dailyRevealLimit, tier } = useEntitlement();
  const dailyRevealCount = useReveal((s) => s.dailyRevealCount);
  const canShowPaywall = usePaywall((s) => s.canShowPaywall);
  const hasCompletedFirstReveal = usePaywall(
    (s) => s.hasCompletedFirstReveal,
  );
  const markFirstRevealCompleted = usePaywall(
    (s) => s.markFirstRevealCompleted,
  );
  const markPostRevealPaywallSeen = usePaywall(
    (s) => s.markPostRevealPaywallSeen,
  );

  const [showPaywall, setShowPaywall] = useState(false);
  const [showLimitNudge, setShowLimitNudge] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<PaywallTrigger | null>(
    null,
  );

  const prevCountRef = useRef(dailyRevealCount);
  const remaining = Math.max(0, dailyRevealLimit - dailyRevealCount);
  const isAtLimit = tier === "free" && remaining <= 0;

  // Detect first reveal for post-value paywall trigger
  useEffect(() => {
    if (tier !== "free") return;
    if (dailyRevealCount > prevCountRef.current && !hasCompletedFirstReveal) {
      markFirstRevealCompleted();
    }
    prevCountRef.current = dailyRevealCount;
  }, [
    dailyRevealCount,
    tier,
    hasCompletedFirstReveal,
    markFirstRevealCompleted,
  ]);

  // Show post-first-reveal paywall after first successful reveal
  useEffect(() => {
    if (tier !== "free") return;
    if (!hasCompletedFirstReveal) return;
    if (showPaywall) return;

    if (canShowPaywall("post_first_reveal")) {
      const timer = setTimeout(() => {
        setActiveTrigger("post_first_reveal");
        setShowPaywall(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [tier, hasCompletedFirstReveal, canShowPaywall, showPaywall]);

  // Show limit nudge when limit is hit
  useEffect(() => {
    if (tier !== "free") return;
    if (isAtLimit && !showPaywall) {
      setShowLimitNudge(true);
    }
  }, [isAtLimit, tier, showPaywall]);

  const openPaywall = useCallback((trigger: PaywallTrigger) => {
    setActiveTrigger(trigger);
    setShowPaywall(true);
    setShowLimitNudge(false);
  }, []);

  const closePaywall = useCallback(() => {
    if (activeTrigger === "post_first_reveal") {
      markPostRevealPaywallSeen();
    }
    setShowPaywall(false);
    setActiveTrigger(null);
  }, [activeTrigger, markPostRevealPaywallSeen]);

  const dismissLimitNudge = useCallback(() => {
    setShowLimitNudge(false);
  }, []);

  return {
    showPaywall,
    showLimitNudge,
    activeTrigger,
    openPaywall,
    closePaywall,
    dismissLimitNudge,
    remainingReveals: remaining,
    isAtLimit,
  };
}
