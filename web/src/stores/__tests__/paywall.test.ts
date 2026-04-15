import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePaywall } from "../paywall";
import { PAYWALL } from "@/lib/config";

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

describe("paywall store", () => {
  beforeEach(() => {
    usePaywall.setState({
      lastDismissedAt: null,
      hasCompletedFirstReveal: false,
      hasSeenPostRevealPaywall: false,
    });
  });

  describe("dismiss()", () => {
    it("sets lastDismissedAt to current time", () => {
      const before = Date.now();
      usePaywall.getState().dismiss();
      const after = Date.now();

      const ts = usePaywall.getState().lastDismissedAt;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe("markFirstRevealCompleted()", () => {
    it("sets hasCompletedFirstReveal to true", () => {
      usePaywall.getState().markFirstRevealCompleted();
      expect(usePaywall.getState().hasCompletedFirstReveal).toBe(true);
    });

    it("is idempotent", () => {
      usePaywall.getState().markFirstRevealCompleted();
      usePaywall.getState().markFirstRevealCompleted();
      expect(usePaywall.getState().hasCompletedFirstReveal).toBe(true);
    });
  });

  describe("markPostRevealPaywallSeen()", () => {
    it("sets hasSeenPostRevealPaywall to true", () => {
      usePaywall.getState().markPostRevealPaywallSeen();
      expect(usePaywall.getState().hasSeenPostRevealPaywall).toBe(true);
    });
  });

  describe("isDismissCooldownActive()", () => {
    it("returns false when never dismissed", () => {
      expect(usePaywall.getState().isDismissCooldownActive()).toBe(false);
    });

    it("returns true when dismissed within 48h", () => {
      usePaywall.setState({ lastDismissedAt: Date.now() - 1000 });
      expect(usePaywall.getState().isDismissCooldownActive()).toBe(true);
    });

    it("returns false when dismissed more than 48h ago", () => {
      usePaywall.setState({
        lastDismissedAt: Date.now() - PAYWALL.FREQUENCY_CAP_MS - 1000,
      });
      expect(usePaywall.getState().isDismissCooldownActive()).toBe(false);
    });
  });

  describe("canShowPaywall()", () => {
    describe("gated_feature trigger", () => {
      it("always returns true regardless of cooldown", () => {
        usePaywall.setState({ lastDismissedAt: Date.now() });
        expect(usePaywall.getState().canShowPaywall("gated_feature")).toBe(true);
      });
    });

    describe("daily_limit_hit trigger", () => {
      it("returns true when no cooldown active", () => {
        expect(usePaywall.getState().canShowPaywall("daily_limit_hit")).toBe(
          true,
        );
      });

      it("returns false during cooldown", () => {
        usePaywall.setState({ lastDismissedAt: Date.now() });
        expect(usePaywall.getState().canShowPaywall("daily_limit_hit")).toBe(
          false,
        );
      });
    });

    describe("post_first_reveal trigger", () => {
      it("returns false when first reveal not completed", () => {
        expect(
          usePaywall.getState().canShowPaywall("post_first_reveal"),
        ).toBe(false);
      });

      it("returns true after first reveal with no prior paywall view", () => {
        usePaywall.setState({ hasCompletedFirstReveal: true });
        expect(
          usePaywall.getState().canShowPaywall("post_first_reveal"),
        ).toBe(true);
      });

      it("returns false after post-reveal paywall has been seen", () => {
        usePaywall.setState({
          hasCompletedFirstReveal: true,
          hasSeenPostRevealPaywall: true,
        });
        expect(
          usePaywall.getState().canShowPaywall("post_first_reveal"),
        ).toBe(false);
      });

      it("returns false during cooldown", () => {
        usePaywall.setState({
          hasCompletedFirstReveal: true,
          lastDismissedAt: Date.now(),
        });
        expect(
          usePaywall.getState().canShowPaywall("post_first_reveal"),
        ).toBe(false);
      });
    });
  });
});
