import {
  test,
  expect,
  makeRecentResponse,
  mockSdmRoutes,
  seedOnboarding,
} from "./helpers";

test.describe("@smoke settings page", () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: null });
    await mockSdmRoutes(page, { recent: makeRecentResponse() });
  });

  test("renders the settings content", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("[data-testid='settings-content']")).toBeVisible();
    await expect(page.locator("[data-testid='settings-pick-team']")).toBeVisible();
  });

  test("opening the team picker, selecting, confirming sets the favorite", async ({ page }) => {
    await page.goto("/settings");
    await page.locator("[data-testid='settings-pick-team']").click();
    await expect(page.locator("[data-testid='team-picker']")).toBeVisible();
    await page.locator("[data-testid='team-pick-LAD']").click();
    await page.locator("[data-testid='team-picker-confirm']").click();
    await expect(page.locator("[data-testid='team-picker']")).toHaveCount(0);
    // mlb-teams.ts shows `name` (short — "Dodgers"), not fullName.
    await expect(page.getByText(/Dodgers \(LAD\)/)).toBeVisible();
  });

  test("theme segmented control sets each option", async ({ page }) => {
    await page.goto("/settings");
    const radiogroup = page.locator("[role='radiogroup']").first();
    await radiogroup.getByRole("radio", { name: "Light" }).click();
    await expect(radiogroup.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    await radiogroup.getByRole("radio", { name: "Dark" }).click();
    await expect(radiogroup.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });

  test("toggling the diagnostics 'show stale banners' switch flips its aria-checked", async ({ page }) => {
    await page.goto("/settings");
    // The Diagnostics section is collapsed by default — expand it.
    await page.getByRole("button", { name: /Diagnostics/i }).click();
    const sw = page.getByRole("switch", { name: /Show stale data banners/i });
    const initial = await sw.getAttribute("aria-checked");
    await sw.click();
    const after = await sw.getAttribute("aria-checked");
    expect(after).not.toEqual(initial);
  });

  test("reset-catchup-progress prompt: accepting clears all stored entries", async ({ page }) => {
    await page.addInitScript(() => {
      window.confirm = () => true;
      localStorage.setItem(
        "sd-catchup-state",
        JSON.stringify({
          state: {
            entries: {
              "190121": { cardIndex: 3, completed: true, lastSeenPlayIndex: 99, updatedAt: Date.now() },
            },
          },
          version: 1,
        }),
      );
    });
    await page.goto("/settings");
    await page.getByRole("button", { name: /Diagnostics/i }).click();
    await page.getByRole("button", { name: /Reset catch-up progress/i }).click();
    const after = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-catchup-state");
      return raw ? JSON.parse(raw) : null;
    });
    expect(after.state.entries).toEqual({});
  });

  test("show-welcome-on-next-visit prompt: accepting clears onboarded flag", async ({ page }) => {
    await page.addInitScript(() => {
      window.confirm = () => true;
    });
    await page.goto("/settings");
    await page.getByRole("button", { name: /Diagnostics/i }).click();
    await page.getByRole("button", { name: /Show welcome screen on next visit/i }).click();
    const after = await page.evaluate(() => {
      const raw = localStorage.getItem("sd-onboarding");
      return raw ? JSON.parse(raw) : null;
    });
    expect(after.state.onboarded).toBe(false);
  });
});
