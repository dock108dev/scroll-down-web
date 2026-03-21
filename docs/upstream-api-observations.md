# Upstream Data API — Observations from Web Audit

> **Context:** These observations come from running the Scroll Down Sports web
> app audit suite against `https://sports-data-admin.dock108.ai`. They describe
> what the web client sees — the data API team will know the internals better.

---

## 1. Health Check Latency

**Observation:** The web app's `/api/health` endpoint pings
`/api/admin/sports/games?limit=1` on the backend as a liveness check. Response
times consistently range from **5–8 seconds**.

**Impact:** The web health endpoint sometimes exceeds a 5-second response
threshold in our audit tests. We've bumped the threshold to 10s on our side,
but the underlying latency is notable.

**What it looks like:** The `games?limit=1` query may be doing more work than
a simple liveness probe needs (e.g., joins, aggregations, or cold cache hits).

---

## 2. Fairbet Odds Endpoint Latency

**Observation:** `GET /api/fairbet/odds` consistently takes **2–4 seconds** to
respond. Other endpoints like `/api/golf/tournaments` respond in 100–400ms.

**What it looks like:** The odds endpoint may be aggregating across many
sportsbooks or doing real-time calculations. Not necessarily a bug — just worth
noting that it's the slowest non-health endpoint by a significant margin.

---

## 3. Golf Tournament Data Load Time (Intermittent)

**Observation:** The golf page sometimes takes over 20 seconds for tournament
cards to render after the page loads. The `/api/golf/tournaments` API itself
responds in 100–400ms, so the delay may be on the web side (client rendering,
hydration). However, on some runs the data appears almost instantly while on
others it's notably delayed.

**What it looks like:** Possibly related to client-side caching or the backend
returning stale-while-revalidate data on some requests. Could also be
Next.js hydration timing. Worth monitoring.

---

## 4. Console 400 Errors on Home Page

**Observation:** During page crawls, the home page occasionally produces 400
Bad Request errors in the browser console. These appear as
`Failed to load resource: the server responded with a status of 400`.

**What it looks like:** The web client may be sending requests with parameters
the backend doesn't expect (e.g., date ranges, filter combinations). Could also
be SSE/realtime channel negotiation returning 400 when no valid subscription
is established yet. We're filtering these in our tests for now.

---

## 5. Overflow Elements on All Pages

**Observation:** Every page reports ~92 elements with horizontal overflow
(elements extending beyond `document.documentElement.clientWidth`). This is
consistent across all pages, suggesting it's a global layout/CSS issue rather
than page-specific content.

**Impact:** Not blocking functionality, but may affect mobile experience. This
is a web-side issue, not upstream.

---

*This document is generated from audit observations and updated as new patterns
emerge. Last updated: 2026-03-20.*
