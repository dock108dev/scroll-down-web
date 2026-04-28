// Service worker for Scroll Down Sports
// Cache First: /_next/static/** (immutable hashed assets)
// Network First: /api/games (list) — list reflects fast-moving live state, SWR
//   was serving stale "LIVE" snapshots after games had ended.
// Stale-While-Revalidate: /api/games/[id] (detail) — TTL matches config.ts
//
// Cache version bumped from v1 → v2 to evict poisoned list responses cached
// under the old SWR strategy on existing clients.

const STATIC_CACHE = "sd-static-v1";
const API_CACHE = "sd-api-v2";

// TTL (ms) — must stay in sync with src/lib/config.ts CACHE values
const GAME_DETAIL_TTL_MS = 5 * 60_000;

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

/** True for /api/games (list); false for /api/games/[id] (detail). */
function isGameListRequest(url) {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.length <= 2;
}

/** Returns true if the cached response is still within its TTL. */
function isFresh(response, ttlMs) {
  const ts = response.headers.get("sw-cached-at");
  if (!ts) return false;
  return Date.now() - parseInt(ts, 10) < ttlMs;
}

/**
 * Fetch from the network, stamp with a cache timestamp header, and store in
 * the named cache. Returns the original network response (body unconsumed).
 */
async function fetchAndCache(cacheName, request) {
  const response = await fetch(request);
  if (response.ok) {
    const clone = response.clone();
    const buf = await clone.arrayBuffer();
    const headers = new Headers(clone.headers);
    headers.set("sw-cached-at", String(Date.now()));
    const stamped = new Response(buf, {
      status: clone.status,
      statusText: clone.statusText,
      headers,
    });
    caches.open(cacheName).then((cache) => cache.put(request, stamped));
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

  // ── Network First: game list endpoint ─────────────────────────────────────
  // The list reflects fast-changing live state. We always try the network
  // first so a freshly-finished game shows as Final immediately, and only
  // fall back to cache when the network is unavailable.
  if (isGameApiRequest(url) && isGameListRequest(url)) {
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

  // ── Stale-While-Revalidate: game detail endpoint ──────────────────────────
  if (isGameApiRequest(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);

        if (cached) {
          if (!isFresh(cached, GAME_DETAIL_TTL_MS)) {
            // Stale: kick off background revalidation and serve immediately
            event.waitUntil(
              fetchAndCache(API_CACHE, event.request.clone()).catch(() => {})
            );
          }
          return cached;
        }

        // No cached entry: wait for network response
        try {
          return await fetchAndCache(API_CACHE, event.request.clone());
        } catch {
          // Network unavailable and no cache — return offline fallback
          const fallback = await caches.match("/offline.html");
          return (
            fallback ||
            new Response("Service unavailable offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })
    );
    return;
  }
});
