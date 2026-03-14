import { test, expect, waitForLoad } from "../helpers";

test.describe("Home page – score reveal", () => {
  test.beforeEach(async ({ authedPage }) => {
    // Clear read state so scores start hidden
    await authedPage.goto("/");
    await authedPage.evaluate(() =>
      localStorage.removeItem("sd-read-state"),
    );
    await authedPage.reload();
    await waitForLoad(authedPage);
  });

  test("games with scores show Reveal button when in hide mode", async ({
    authedPage,
  }) => {
    const revealButtons = authedPage.getByRole("button", { name: /reveal/i });
    const count = await revealButtons.count();

    // There may or may not be revealable scores depending on live data
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

    // After reveal, score text with en-dash should appear
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

    // Verify localStorage was updated
    const readState = await authedPage.evaluate(() =>
      localStorage.getItem("sd-read-state"),
    );
    expect(readState).toBeTruthy();

    // Reload and confirm the score is still visible
    await authedPage.reload();
    await waitForLoad(authedPage);

    const scoreText = authedPage.locator("text=/\\d+\\s*\\u2013\\s*\\d+/").first();
    await expect(scoreText).toBeVisible({ timeout: 3000 });
  });

  test("Read button appears when there are unread final games", async ({
    authedPage,
  }) => {
    // The Read button may not be visible if there are no final games with hidden scores
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

    // Count reveal buttons before
    const revealCountBefore = await authedPage
      .getByRole("button", { name: /reveal/i })
      .count();

    await readBtn.click();
    await authedPage.waitForTimeout(500);

    // After batch read, reveal button count should decrease
    const revealCountAfter = await authedPage
      .getByRole("button", { name: /reveal/i })
      .count();

    expect(revealCountAfter).toBeLessThan(revealCountBefore);
  });
});
