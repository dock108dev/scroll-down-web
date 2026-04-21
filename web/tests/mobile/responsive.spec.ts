import { test, expect, waitForLoad, waitForGameData, waitForProGateTestHook } from "../helpers";

test.describe("Mobile Responsive Layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("BottomTabs nav is visible at mobile width @smoke", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // BottomTabs is the fixed-bottom nav (has Settings button, not link)
    const bottomNav = authedPage.locator("nav.fixed");
    await expect(bottomNav).toBeVisible();

    // Check that expected tab labels are present in bottom nav
    for (const label of ["Games", "FairBet", "Settings"]) {
      await expect(bottomNav.getByText(label)).toBeVisible();
    }
  });

  test("Bottom tab navigation works - clicking FairBet tab navigates to /fairbet", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    // Click FairBet tab in bottom nav (use fixed nav to avoid hidden desktop nav)
    const bottomNav = authedPage.locator("nav.fixed");
    const fairbetTab = bottomNav.getByText("FairBet");
    await fairbetTab.click();
    await authedPage.waitForURL(/\/fairbet/, { timeout: 5000 });
    expect(authedPage.url()).toContain("/fairbet");
  });

  test("Game rows render at mobile width @smoke", async ({ authedPage }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    const gameRows = authedPage.locator("[data-testid='game-row']");
    const count = await gameRows.count();
    expect(count).toBeGreaterThan(0);

    // First game row should be visible and within viewport width
    const firstGame = gameRows.first();
    await expect(firstGame).toBeVisible();
    const box = await firstGame.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(390);
  });

  test("Login page form is usable at mobile width @smoke", async ({
    authedPage,
  }) => {
    await authedPage.goto("/login");
    await waitForLoad(authedPage);

    // Email input should be visible and interactable
    const emailInput = authedPage.getByPlaceholder("you@example.com");
    await expect(emailInput).toBeVisible();

    const box = await emailInput.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(390);

    // Input should be fillable
    await emailInput.fill("test@example.com");
    expect(await emailInput.inputValue()).toBe("test@example.com");
  });

  // ── BottomTabs admin gating ───────────────────────────────────────────
  // Non-admin users must not see admin-only tabs (Analytics, History) and
  // must not see removed surfaces (Golf). Mirrors TopNav's NAV_LINKS filter.

  test("BottomTabs hides admin-only tabs for non-admin users @smoke", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await waitForLoad(authedPage);

    const bottomNav = authedPage.locator("nav.fixed");
    await expect(bottomNav).toBeVisible();

    for (const hidden of ["Golf", "Analytics", "History"]) {
      await expect(bottomNav.getByText(hidden, { exact: true })).toHaveCount(0);
    }
  });

  test("BottomTabs shows admin tabs for admin users, still hides Golf @smoke", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-auth");
      if (!raw) throw new Error("sd-auth not seeded");
      const parsed = JSON.parse(raw);
      parsed.state.role = "admin";
      localStorage.setItem("sd-auth", JSON.stringify(parsed));
    });
    await authedPage.reload();
    await waitForLoad(authedPage);

    const bottomNav = authedPage.locator("nav.fixed");
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByText("Analytics", { exact: true })).toBeVisible();
    await expect(bottomNav.getByText("History", { exact: true })).toBeVisible();
    // Golf was removed from the product nav entirely — never shown, even to admins.
    await expect(bottomNav.getByText("Golf", { exact: true })).toHaveCount(0);
  });

  // ── Reveal button visibility ──────────────────────────────────────────
  // Guards the reveal affordance the user reported as "missing on mobile".

  test("Reveal button is visible on game rows in onMarkRead mode @smoke", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    // Force settings into reveal mode so the test is deterministic regardless of
    // any followingLive state a previous session may have left behind.
    await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-settings");
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 2 };
      parsed.state = {
        ...parsed.state,
        scoreRevealMode: "onMarkRead",
        followingLive: false,
      };
      localStorage.setItem("sd-settings", JSON.stringify(parsed));
    });
    await authedPage.reload();
    await waitForLoad(authedPage);

    const hasData = await waitForGameData(authedPage);
    if (!hasData) { test.skip(true, "No game data"); return; }

    // At least one game row should have a reveal button — it only renders for
    // final/live games, but authedPage uses the default backend which normally
    // has some.
    const revealButtons = authedPage.locator("[data-testid='reveal-button']");
    await expect(revealButtons.first()).toBeVisible({ timeout: 5_000 });
  });

  // ── ProGateSheet vs BottomTabs ────────────────────────────────────────
  // When the upgrade sheet is open on mobile, BottomTabs must not be reachable —
  // the backdrop sits above the tab bar. The sheet itself must also clear the
  // 64px tab bar so the Upgrade CTA is not buried.

  test("ProGateSheet backdrop covers BottomTabs on mobile @smoke", async ({
    page,
  }) => {
    await page.goto("/?tier=free");
    await waitForProGateTestHook(page);

    await page.evaluate(() => {
      const fn = (window as unknown as Record<string, unknown>).__openProGateSheet as
        | ((feature: string) => void)
        | undefined;
      if (!fn) throw new Error("__openProGateSheet not mounted");
      fn("live_odds");
    });

    const sheet = page.locator("[data-testid='pro-gate-sheet']");
    const backdrop = page.locator("[data-testid='pro-gate-backdrop']");
    const bottomTabs = page.locator("nav[data-testid='bottom-tabs']");
    await expect(sheet).toBeVisible({ timeout: 3_000 });
    await expect(backdrop).toBeVisible();

    // Backdrop must paint above BottomTabs (z-[60] vs z-50).
    const backdropZ = await backdrop.evaluate((el) =>
      parseInt(getComputedStyle(el).zIndex || "0", 10),
    );
    const tabsZ = await bottomTabs.evaluate((el) =>
      parseInt(getComputedStyle(el).zIndex || "0", 10),
    );
    expect(backdropZ).toBeGreaterThan(tabsZ);

    // Sheet body must not overlap the bottom tabs region (bottom-16 clears 64px).
    const sheetBox = await sheet.boundingBox();
    const tabsBox = await bottomTabs.boundingBox();
    expect(sheetBox).toBeTruthy();
    expect(tabsBox).toBeTruthy();
    expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(tabsBox!.y + 1);
  });
});
