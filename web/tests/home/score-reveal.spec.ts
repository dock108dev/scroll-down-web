import { test, expect, waitForLoad } from "../helpers";

const IDB_NAME = "scroll-down";

/** Returns true if IDB revealState has at least one revealed ID. */
async function idbHasRevealedIds(
  page: Parameters<typeof waitForLoad>[0],
): Promise<boolean> {
  return page.evaluate(
    ({ dbName }) =>
      new Promise<boolean>((resolve) => {
        const req = indexedDB.open(dbName, 1);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("revealState")) {
            resolve(false);
            return;
          }
          const tx = db.transaction("revealState", "readonly");
          const getReq = tx.objectStore("revealState").get("main");
          getReq.onsuccess = () => {
            const record = getReq.result as
              | { revealedIds?: number[] }
              | undefined;
            resolve((record?.revealedIds?.length ?? 0) > 0);
          };
          getReq.onerror = () => resolve(false);
        };
        req.onerror = () => resolve(false);
      }),
    { dbName: IDB_NAME },
  );
}

test.describe("Home page – score reveal", () => {
  test.beforeEach(async ({ authedPage }) => {
    // Clear IDB reveal state and legacy localStorage key
    await authedPage.goto("/");
    await authedPage.evaluate(
      ({ dbName }) =>
        new Promise<void>((resolve) => {
          localStorage.removeItem("sd-read-state");
          const req = indexedDB.open(dbName, 1);
          const finish = () => resolve();
          req.onsuccess = () => {
            const db = req.result;
            const stores = ["revealState", "syncQueue"];
            let pending = stores.length;
            for (const storeName of stores) {
              if (!db.objectStoreNames.contains(storeName)) {
                if (--pending === 0) finish();
                continue;
              }
              const tx = db.transaction(storeName, "readwrite");
              tx.objectStore(storeName).clear();
              tx.oncomplete = () => { if (--pending === 0) finish(); };
              tx.onerror = () => { if (--pending === 0) finish(); };
            }
            if (pending === 0) finish();
          };
          req.onerror = () => finish();
        }),
      { dbName: IDB_NAME },
    );
    await authedPage.reload();
    await waitForLoad(authedPage);
  });

  test("games with scores show Reveal button when in hide mode", async ({
    authedPage,
  }) => {
    const revealButtons = authedPage.getByRole("button", { name: /reveal/i });
    const count = await revealButtons.count();

    if (count === 0) {
      test.skip(true, "No revealable scores available at this time");
      return;
    }
    await expect(revealButtons.first()).toBeVisible();
  });

  test("clicking Reveal shows the score", async ({ authedPage }) => {
    const revealBtn = authedPage.getByRole("button", { name: /reveal/i });
    const count = await revealBtn.count();
    if (count === 0) {
      test.skip(true, "No revealable scores available at this time");
      return;
    }

    await revealBtn.first().click();

    const scoreText = authedPage.locator("text=/\\d+\\s*\\u2013\\s*\\d+/").first();
    await expect(scoreText).toBeVisible({ timeout: 3000 });
  });

  test("score visibility persists after page reload", async ({
    authedPage,
  }) => {
    const revealBtn = authedPage.getByRole("button", { name: /reveal/i });
    const count = await revealBtn.count();
    if (count === 0) {
      test.skip(true, "No revealable scores available at this time");
      return;
    }

    await revealBtn.first().click();
    await authedPage.waitForTimeout(500); // let IDB write complete

    // Verify IDB was updated
    const hasRevealed = await idbHasRevealedIds(authedPage);
    expect(hasRevealed).toBe(true);

    // Reload and confirm the score is still visible
    await authedPage.reload();
    await waitForLoad(authedPage);

    const scoreText = authedPage.locator("text=/\\d+\\s*\\u2013\\s*\\d+/").first();
    await expect(scoreText).toBeVisible({ timeout: 3000 });
  });

  test("Read button appears when there are unread final games", async ({
    authedPage,
  }) => {
    const readBtn = authedPage.getByRole("button", { name: /^read$/i });
    const count = await readBtn.count();
    if (count === 0) {
      test.skip(true, "No unread final games available at this time");
      return;
    }
    await expect(readBtn).toBeVisible({ timeout: 5000 });
  });

  test("clicking Read reveals scores in batch", async ({ authedPage }) => {
    const readBtn = authedPage.getByRole("button", { name: /^read$/i });
    const readCount = await readBtn.count();
    if (readCount === 0) {
      test.skip(true, "No unread final games available at this time");
      return;
    }

    await expect(readBtn).toBeVisible({ timeout: 5000 });

    const revealCountBefore = await authedPage
      .getByRole("button", { name: /reveal/i })
      .count();

    await readBtn.click();
    await authedPage.waitForTimeout(500);

    const revealCountAfter = await authedPage
      .getByRole("button", { name: /reveal/i })
      .count();

    expect(revealCountAfter).toBeLessThan(revealCountBefore);
  });
});
