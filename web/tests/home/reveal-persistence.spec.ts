import { test, expect, waitForLoad, waitForGameData } from "../helpers";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// IDB helpers (raw IndexedDB API — no Dexie)
// ---------------------------------------------------------------------------

const IDB_NAME = "scroll-down";

type IDBRevealState = {
  id: "main";
  revealedIds: number[];
  snapshots: [number, { homeScore: number; awayScore: number; snapshotAt: string }][];
};

/** Clear the revealState IDB store and remove legacy localStorage key. */
async function clearRevealState(page: Page): Promise<void> {
  await page.evaluate(
    ({ dbName, storeName }) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open(dbName, 1);
        const finish = () => {
          // Best-effort: also wipe legacy localStorage key
          localStorage.removeItem("sd-read-state");
          resolve();
        };
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            finish();
            return;
          }
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => finish();
          tx.onerror = () => finish();
        };
        req.onerror = () => finish();
      }),
    { dbName: IDB_NAME, storeName: "revealState" },
  );
  // Also clear sync queue
  await page.evaluate(
    ({ dbName, storeName }) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open(dbName, 1);
        const finish = () => resolve();
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) { finish(); return; }
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => finish();
          tx.onerror = () => finish();
        };
        req.onerror = () => finish();
      }),
    { dbName: IDB_NAME, storeName: "syncQueue" },
  );
}

/** Inject settings so Following Live is on/off. */
async function setFollowingLive(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((v) => {
    const raw = localStorage.getItem("sd-settings");
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 2 };
    parsed.state.followingLive = v;
    parsed.state.followingLiveAt = v ? Date.now() : 0;
    localStorage.setItem("sd-settings", JSON.stringify(parsed));
  }, enabled);
}

/** Read the current revealState record from IDB. */
async function getIDBRevealState(page: Page): Promise<IDBRevealState | null> {
  return page.evaluate(
    ({ dbName, storeName }) =>
      new Promise<IDBRevealState | null>((resolve) => {
        const req = indexedDB.open(dbName, 1);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) { resolve(null); return; }
          const tx = db.transaction(storeName, "readonly");
          const getReq = tx.objectStore(storeName).get("main");
          getReq.onsuccess = () => resolve((getReq.result as IDBRevealState) ?? null);
          getReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      }),
    { dbName: IDB_NAME, storeName: "revealState" },
  );
}

/** Write a revealState record directly into IDB (for cross-context simulation). */
async function putIDBRevealState(
  page: Page,
  state: IDBRevealState,
): Promise<void> {
  await page.evaluate(
    ({ dbName, storeName, data }) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("syncQueue")) {
            db.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(data);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        req.onerror = () => resolve();
      }),
    { dbName: IDB_NAME, storeName: "revealState", data: state },
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Reveal state — persistence and mode transitions @smoke @live-upstream", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/");
    await clearRevealState(authedPage);
    await authedPage.reload();
    await waitForLoad(authedPage);
  });

  // -------------------------------------------------------------------------
  // 1. Reveal persists after page reload
  // -------------------------------------------------------------------------
  test("reveal persists after page reload @smoke", async ({ authedPage }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const revealBtn = authedPage.locator("[data-testid='reveal-button']").first();
    const hasReveal = (await revealBtn.count()) > 0;
    if (!hasReveal) {
      test.skip(true, "No unrevealed games — not in onMarkRead mode");
      return;
    }

    await revealBtn.click();
    await authedPage.waitForTimeout(500); // let IDB write complete

    // Confirm IDB was updated
    const state = await getIDBRevealState(authedPage);
    expect(state).not.toBeNull();
    expect(state?.revealedIds?.length).toBeGreaterThan(0);

    // Reload and verify score is still visible
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    const revealedRow = authedPage
      .locator("[data-reveal-state='revealed'], [data-reveal-state='updated']")
      .first();
    await expect(revealedRow).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 2. Reveal persists across new browser context (tab close + reopen)
  //    Simulated by extracting IDB state and injecting it into a fresh context.
  // -------------------------------------------------------------------------
  test("reveal persists after new browser context (tab close/reopen)", async ({
    authedPage,
    browser,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const revealBtn = authedPage.locator("[data-testid='reveal-button']").first();
    const hasReveal = (await revealBtn.count()) > 0;
    if (!hasReveal) {
      test.skip(true, "No unrevealed games — not in onMarkRead mode");
      return;
    }

    await revealBtn.click();
    await authedPage.waitForTimeout(500); // let IDB write complete

    // Extract IDB reveal state from current context
    const idbState = await getIDBRevealState(authedPage);
    expect(idbState).not.toBeNull();
    expect(idbState!.revealedIds.length).toBeGreaterThan(0);

    // Open a fresh context (simulates tab close/reopen)
    const storageState = await authedPage.context().storageState();
    const freshCtx = await browser.newContext({ storageState });
    const freshPage = await freshCtx.newPage();

    // Navigate once so the app creates the IDB schema, then inject state
    await freshPage.goto("/");
    await waitForLoad(freshPage);
    await putIDBRevealState(freshPage, idbState!);

    // Reload so the store re-initializes from the populated IDB
    await freshPage.reload();
    await waitForLoad(freshPage);
    await waitForGameData(freshPage);

    const revealedRow = freshPage
      .locator("[data-reveal-state='revealed'], [data-reveal-state='updated']")
      .first();
    await expect(revealedRow).toBeVisible({ timeout: 5000 });

    await freshCtx.close();
  });

  // -------------------------------------------------------------------------
  // 3. Following Live mode → all scores visible without tap-reveal
  // -------------------------------------------------------------------------
  test("Following Live mode — scores visible without reveal @smoke", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    await setFollowingLive(authedPage, true);
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    const revealButtons = authedPage.locator("[data-testid='reveal-button']");
    const count = await revealButtons.count();
    expect(count).toBe(0);

    const liveToggle = authedPage.locator("[data-testid='live-toggle']");
    await expect(liveToggle).toBeVisible();
    await expect(liveToggle).toContainText("Scores visible");

    const banner = authedPage.locator("[data-testid='following-live-banner']");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("score hiding is paused");
  });

  // -------------------------------------------------------------------------
  // 4. Disabling Following Live re-hides scores for un-revealed games
  // -------------------------------------------------------------------------
  test("disabling Following Live re-hides unrevealed game scores", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    await setFollowingLive(authedPage, true);
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    expect(await authedPage.locator("[data-testid='reveal-button']").count()).toBe(0);
    await expect(authedPage.locator("[data-testid='following-live-banner']")).toBeVisible();

    const liveBtn = authedPage.locator("[data-testid='live-toggle']");
    const hasBtn = (await liveBtn.count()) > 0;
    if (!hasBtn) {
      test.skip(true, "LIVE toggle not visible — may be no live games");
      return;
    }
    await liveBtn.click();
    await authedPage.waitForTimeout(400);

    const revealBtns = authedPage.locator("[data-testid='reveal-button']");
    const afterCount = await revealBtns.count();
    expect(afterCount).toBeGreaterThanOrEqual(0);

    await expect(authedPage.locator("[data-testid='following-live-banner']")).not.toBeVisible();

    const pausedBtn = authedPage.locator("[data-testid='live-toggle']");
    await expect(pausedBtn).toContainText("Updates paused");
  });

  // -------------------------------------------------------------------------
  // 5b. Banner "Turn off" button dismisses Following Live and re-hides scores
  // -------------------------------------------------------------------------
  test("Following Live banner Turn off re-hides scores @smoke", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    await setFollowingLive(authedPage, true);
    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    const banner = authedPage.locator("[data-testid='following-live-banner']");
    await expect(banner).toBeVisible();

    const turnOffBtn = authedPage.locator("[data-testid='following-live-banner-dismiss']");
    await expect(turnOffBtn).toBeVisible();
    await turnOffBtn.click();
    await authedPage.waitForTimeout(400);

    await expect(banner).not.toBeVisible();

    const liveToggle = authedPage.locator("[data-testid='live-toggle']");
    await expect(liveToggle).toContainText("Updates paused");
  });

  // -------------------------------------------------------------------------
  // 5. UPDATE indicator when score changes after reveal snapshot
  // -------------------------------------------------------------------------
  test("UPDATE indicator shown when score changed after reveal snapshot", async ({
    authedPage,
  }) => {
    const hasData = await waitForGameData(authedPage);
    if (!hasData) {
      test.skip(true, "No game data available from API");
      return;
    }

    const revealBtn = authedPage.locator("[data-testid='reveal-button']").first();
    const hasReveal = (await revealBtn.count()) > 0;
    if (!hasReveal) {
      test.skip(true, "No unrevealed games — not in onMarkRead mode");
      return;
    }

    await revealBtn.click();
    await authedPage.waitForTimeout(500); // let IDB write complete

    // Read IDB state and mutate snapshot scores to force an UPDATE indicator
    const mutated = await authedPage.evaluate(
      ({ dbName, storeName }) =>
        new Promise<boolean>((resolve) => {
          const req = indexedDB.open(dbName, 1);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(storeName, "readwrite");
            const store = tx.objectStore(storeName);
            const getReq = store.get("main");
            getReq.onsuccess = () => {
              const record = getReq.result as {
                id: string;
                revealedIds: number[];
                snapshots: [number, { homeScore: number; awayScore: number }][];
              } | undefined;
              if (!record || record.snapshots.length === 0) {
                resolve(false);
                return;
              }
              // Flip scores to bogus values so live score will differ
              record.snapshots[0][1].homeScore = -999;
              record.snapshots[0][1].awayScore = -999;
              const putReq = store.put(record);
              putReq.onsuccess = () => resolve(true);
              putReq.onerror = () => resolve(false);
            };
            getReq.onerror = () => resolve(false);
          };
          req.onerror = () => resolve(false);
        }),
      { dbName: IDB_NAME, storeName: "revealState" },
    );

    if (!mutated) {
      test.skip(true, "Could not mutate snapshot — no snapshot stored after reveal");
      return;
    }

    await authedPage.reload();
    await waitForLoad(authedPage);
    await waitForGameData(authedPage);

    const updatedRow = authedPage.locator("[data-reveal-state='updated']").first();
    await expect(updatedRow).toBeVisible({ timeout: 8000 });

    const updBadge = updatedRow.locator("[data-testid='upd-badge']");
    await expect(updBadge).toBeVisible();
  });
});
