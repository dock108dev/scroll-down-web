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
}
