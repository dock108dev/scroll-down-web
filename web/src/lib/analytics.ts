/**
 * Lightweight self-hosted analytics client.
 *
 * Tracks pageviews automatically and exposes trackEvent() for custom events.
 * Uses navigator.sendBeacon for reliable delivery (works even on page unload).
 * No cookies, no PII, no external dependencies.
 */

const ENDPOINT = "/api/analytics-event";

function getScreenSize(): string {
  if (typeof window === "undefined") return "";
  return `${window.screen.width}x${window.screen.height}`;
}

function send(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify({
      ...payload,
      screen: getScreenSize(),
      timestamp: Date.now(),
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, body);
    } else {
      // Fallback for older browsers
      fetch(ENDPOINT, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics should never break the app
  }
}

/** Track a pageview. Called automatically by AnalyticsProvider. */
export function trackPageview(url: string) {
  send({
    type: "pageview",
    url,
    referrer: typeof document !== "undefined" ? document.referrer : "",
  });
}

/**
 * Track a custom event.
 *
 * @example
 *   trackEvent("signup_click", { source: "hero" });
 *   trackEvent("simulation_run", { sport: "nba" });
 *   trackEvent("bet_card_expand");
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>,
) {
  send({
    type: "event",
    url: typeof window !== "undefined" ? window.location.pathname : "",
    name,
    props,
  });

  // Bridge to Plausible if loaded
  if (typeof window !== "undefined") {
    const w = window as unknown as Record<string, unknown>;
    if (typeof w.plausible === "function") {
      (w.plausible as (n: string, o?: { props?: Record<string, string | number | boolean> }) => void)(
        name,
        props ? { props } : undefined,
      );
    }
  }
}

// ── Scroll depth tracking ─────────────────────────────────────

let scrollCleanup: (() => void) | null = null;

/**
 * Track scroll depth milestones (50%, 90%). Fires each event once per page.
 * Call in a mount useEffect — returns a cleanup function.
 */
export function initScrollTracking(): () => void {
  // Clean up previous listener (e.g. on route change)
  scrollCleanup?.();

  let fired50 = false;
  let fired90 = false;
  let ticking = false;

  const handler = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const scrollTop = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (height <= 0) return;
      const pct = (scrollTop / height) * 100;

      if (pct > 50 && !fired50) {
        fired50 = true;
        trackEvent("scroll_50");
      }
      if (pct > 90 && !fired90) {
        fired90 = true;
        trackEvent("scroll_90");
      }
    });
  };

  window.addEventListener("scroll", handler, { passive: true });
  const cleanup = () => {
    window.removeEventListener("scroll", handler);
    scrollCleanup = null;
  };
  scrollCleanup = cleanup;
  return cleanup;
}
