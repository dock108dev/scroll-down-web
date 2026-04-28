// Service worker for Scroll Down Sports
// Cache First: /_next/static/** (immutable hashed assets)
// Network First: /api/games/** (list and detail) — both reflect fast-moving
//   live state. SWR was serving stale "LIVE" snapshots after games had ended,
//   and on the detail page it left the play-by-play stuck at the snapshot
//   captured the first time the user viewed the game. Cache is now used only
//   as an offline fallback.
//
// Cache version bumped to v2 to evict poisoned responses cached under the
// previous SWR strategy on existing clients.

const STATIC_CACHE = "sd-static-v1";
const API_CACHE = "sd-api-v2";

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.add("/offline.html"))
  );
  // Take control of all pages immediately, without waiting for old SW to go away
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
  );
  // Claim all open clients so the SW controls pages immediately
  self.clients.claim();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isGameApiRequest(url) {
  return url.pathname.startsWith("/api/games");
}

/**
 * Fetch from the network and store the response in the named cache for use
 * as an offline fallback. Returns the original network response.
 */
async function fetchAndCache(cacheName, request) {
  const response = await fetch(request);
  if (response.ok) {
    const clone = response.clone();
    caches.open(cacheName).then((cache) => cache.put(request, clone));
  }
  return response;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only intercept same-origin GET requests
  if (url.origin !== self.location.origin || event.request.method !== "GET") {
    return;
  }

  // ── Cache First: static assets ────────────────────────────────────────────
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // ── Network First: all game API routes ────────────────────────────────────
  // Both the list and detail endpoints reflect fast-changing live state. Try
  // the network first so freshly-finished games and newly-arrived plays show
  // immediately; fall back to cache only when the network is unavailable.
  if (isGameApiRequest(url)) {
    event.respondWith(
      (async () => {
        try {
          return await fetchAndCache(API_CACHE, event.request.clone());
        } catch {
          const cached = await caches.open(API_CACHE).then((c) => c.match(event.request));
          if (cached) return cached;
          const fallback = await caches.match("/offline.html");
          return (
            fallback ||
            new Response("Service unavailable offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })()
    );
    return;
  }
});
