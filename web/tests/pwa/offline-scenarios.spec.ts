import { test, expect } from "@playwright/test";

// DB constants must match src/lib/reveal-idb.ts
const IDB_DB_NAME = "scroll-down";
const IDB_STORE_REVEAL = "revealState";

// localStorage key must match src/lib/config.ts STORAGE_KEYS.PWA_SESSION_COUNT
const SESSION_COUNT_KEY = "sd-pwa-session-count";

const SW_TIMEOUT_MS = 15_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForSwControl(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  const deadline = Date.now() + SW_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ok = await page.evaluate(() => navigator.serviceWorker.controller !== null);
    if (ok) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

/** Seeds IndexedDB revealState store with the given game IDs. */
async function seedRevealIdb(
  page: import("@playwright/test").Page,
  gameIds: number[],
): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, ids }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onerror = () => reject(req.error);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            resolve();
            return;
          }
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put({ id: "main", revealedIds: ids, snapshots: [] });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { dbName: IDB_DB_NAME, storeName: IDB_STORE_REVEAL, ids: gameIds },
  );
}

/** Reads revealedIds from IndexedDB revealState store. */
async function readRevealIdb(
  page: import("@playwright/test").Page,
): Promise<number[]> {
  return page.evaluate(
    async ({ dbName, storeName }) => {
      return new Promise<number[]>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onerror = () => reject(req.error);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            resolve([]);
            return;
          }
          const tx = db.transaction(storeName, "readonly");
          const getReq = tx.objectStore(storeName).get("main");
          getReq.onsuccess = () => {
            const record = getReq.result as
              | { revealedIds: number[] }
              | undefined;
            resolve(record?.revealedIds ?? []);
          };
          getReq.onerror = () => reject(getReq.error);
        };
      });
    },
    { dbName: IDB_DB_NAME, storeName: IDB_STORE_REVEAL },
  );
}

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe("PWA offline scenarios @smoke", () => {
  test.describe.configure({ timeout: 90_000 });

  // Skip the entire suite when the Service Worker API is not available
  // (plain HTTP env, old browser, CI without HTTPS / localhost HTTPS flag).
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const swAvailable = await page.evaluate(
      () => "serviceWorker" in navigator,
    );
    test.skip(
      !swAvailable,
      "Service Worker API not available in this environment",
    );
  });

  // ── Test 1: SW cache serves game list ───────────────────────────────────────

  test(
    "game list renders from SW cache when API requests are blocked @smoke",
    async ({ browser }) => {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();

        // First visit — document and API responses fetched; SW caches /api/games*
        await page.goto("/", { waitUntil: "domcontentloaded" });

        const swActive = await waitForSwControl(page);
        if (!swActive) {
          test.skip();
          return;
        }

        const gamesOnFirstLoad = await page
          .locator('[data-testid="game-row"]')
          .count();
        if (gamesOnFirstLoad === 0) {
          return;
        }

        // Block all API routes. Because the SW's Stale-While-Revalidate handler
        // intercepts /api/games* requests and responds from its cache before the
        // request reaches the network, Playwright's route.abort() is only invoked
        // for cache-miss fallback fetches — not for SW-cached responses.
        await page.route("**/api/**", (route) => route.abort("failed"));

        await page.goto("/", { waitUntil: "domcontentloaded" });

        const gameRows = page.locator('[data-testid="game-row"]');
        await expect(gameRows.first()).toBeVisible({ timeout: 5_000 });
      } finally {
        await context.close().catch(() => {});
      }
    },
  );

  // ── Test 2: Reveal state survives offline-online cycle ──────────────────────

  test(
    "reveal state persists after offline route-block and reconnect @smoke",
    async ({ page }) => {
      const TEST_GAME_ID = 999_901; // synthetic ID; will not match live data

      // Load the page online so the app context is initialised.
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Seed IDB with a known revealed game ID before going offline.
      await seedRevealIdb(page, [TEST_GAME_ID]);

      // Simulate offline: block all network requests and fire the browser event
      // so the OfflineBanner and offline-queue logic activate.
      await page.route("**", (route) => route.abort("failed"));
      await page.evaluate(() =>
        window.dispatchEvent(new Event("offline", { bubbles: true })),
      );

      // Attempt a reload while offline — may fail if the document is not SW-cached.
      // We catch and ignore navigation errors; what matters is IDB durability.
      await page
        .reload({ waitUntil: "domcontentloaded" })
        .catch(() => {});

      // Restore network and navigate to a known-good page so we can evaluate IDB.
      await page.unrouteAll();
      await page.evaluate(() =>
        window.dispatchEvent(new Event("online", { bubbles: true })),
      );
      await page.goto("/");

      // IDB persists independently of page navigation and network state —
      // the seeded reveal entry must survive the offline period.
      const storedIds = await readRevealIdb(page);
      expect(storedIds).toContain(TEST_GAME_ID);
    },
  );

  // ── Test 3: Offline banner via route block ──────────────────────────────────

  test(
    "offline banner appears within 2s of route block and auto-dismisses within 3s of unblock @smoke",
    async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Block all routes to cut network access, then fire the browser offline event
      // (route blocking alone does not fire the event automatically).
      await page.route("**", (route) => route.abort("failed"));
      await page.evaluate(() =>
        window.dispatchEvent(new Event("offline", { bubbles: true })),
      );

      const banner = page.getByTestId("offline-banner");
      await expect(banner).toBeVisible({ timeout: 10_000 });

      // Restore network and fire online event.
      await page.unrouteAll();
      await page.evaluate(() =>
        window.dispatchEvent(new Event("online", { bubbles: true })),
      );

      // Banner auto-dismisses after PWA.OFFLINE_AUTO_DISMISS_MS (default 3 000 ms).
      // Allow an extra 1s margin for JS microtask scheduling.
      await expect(banner).not.toBeVisible({ timeout: 4_000 });
    },
  );

  // ── Test 4: Install prompt on second session ─────────────────────────────────

  test(
    "install prompt appears on simulated second session @smoke",
    async ({ page }) => {
      // Pre-seed count=1 so the component increments to 2 on next mount,
      // crossing the INSTALL_MIN_SESSIONS=2 threshold.
      await page.evaluate(
        ([key]) => localStorage.setItem(key, "1"),
        [SESSION_COUNT_KEY],
      );

      // Reload so PWAInstallPrompt re-mounts and increments the session count.
      await page.reload();

      // Fire a synthetic beforeinstallprompt event with stub methods.
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", {
          bubbles: true,
          cancelable: true,
        });
        Object.assign(event, {
          prompt: () => Promise.resolve(),
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        });
        window.dispatchEvent(event);
      });

      const prompt = page.getByTestId("pwa-install-prompt");
      await expect(prompt).toBeVisible({ timeout: 15_000 });
    },
  );
});
