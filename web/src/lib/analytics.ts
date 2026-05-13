/**
 * Analytics bridge to Plausible.
 *
 * Plausible is the only analytics sink in this repo (see `docs/architecture.md`
 * §Analytics). The script tag is loaded in `web/src/app/layout.tsx`; this
 * module exposes thin helpers that call `window.plausible(...)` when the
 * global is available. Both helpers are no-ops on the server, before the
 * Plausible script has loaded, or in any environment where the script was
 * blocked (ad-blockers, DNT, etc.).
 *
 * No PII, no cookies, no first-party endpoint — there is no
 * `/api/analytics-event` route in this repo and never was.
 */

type PlausibleGlobal = (
  name: string,
  opts?: { props?: Record<string, string | number | boolean>; u?: string },
) => void;

function getPlausible(): PlausibleGlobal | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const fn = w.plausible;
  return typeof fn === "function" ? (fn as PlausibleGlobal) : null;
}

/**
 * Track a pageview. Called by `AnalyticsProvider` on route change. Best-effort
 * — Plausible's standard `script.js` auto-tracks the initial pageview but
 * relies on a manual `plausible('pageview')` call for SPA navigations, so
 * SPA pageview delivery depends on the script flavor loaded in `layout.tsx`.
 */
export function trackPageview(url: string) {
  getPlausible()?.("pageview", { u: url });
}

/**
 * Track a custom event. Props are passed through to Plausible.
 *
 * @example
 *   trackEvent("catchup_open", { gameId: "12345" });
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>,
) {
  getPlausible()?.(name, props ? { props } : undefined);
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
