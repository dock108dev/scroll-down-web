import { test, expect, waitForLoad } from "../helpers";

test.describe("Analytics navigation @smoke", () => {
  test("/analytics/mlb redirects to /analytics/simulator", async ({
    authedPage,
  }) => {
    await authedPage.goto("/analytics/mlb");
    await authedPage.waitForURL("/analytics/simulator", { timeout: 10_000 });
    expect(authedPage.url()).toContain("/analytics/simulator");
  });

  test("tab bar is visible on simulator page", async ({ authedPage }) => {
    await authedPage.goto("/analytics/simulator");
    await waitForLoad(authedPage);

    // User-visible tabs should always be present
    const simulatorTab = authedPage.getByRole("link", { name: "Simulator" });
    const profilesTab = authedPage.getByRole("link", { name: "Profiles" });
    await expect(simulatorTab).toBeVisible();
    await expect(profilesTab).toBeVisible();
  });

  test("simulator tab is active on simulator page", async ({ authedPage }) => {
    await authedPage.goto("/analytics/simulator");
    await waitForLoad(authedPage);

    const simulatorTab = authedPage.getByRole("link", { name: "Simulator" });
    await expect(simulatorTab).toHaveClass(/border-blue-500/);
  });

  test("clicking Profiles tab navigates to profiles page", async ({
    authedPage,
  }) => {
    await authedPage.goto("/analytics/simulator");
    await waitForLoad(authedPage);

    await authedPage.getByRole("link", { name: "Profiles" }).click();
    await authedPage.waitForURL("/analytics/profiles", { timeout: 10_000 });
    expect(authedPage.url()).toContain("/analytics/profiles");
  });

  test("admin tabs hidden for regular users", async ({ authedPage }) => {
    await authedPage.goto("/analytics/simulator");
    await waitForLoad(authedPage);

    // Check the role — if user is not admin, admin tabs should be hidden
    const role = await authedPage.evaluate(() => {
      const raw = localStorage.getItem("sd-auth");
      if (!raw) return "guest";
      try {
        return JSON.parse(raw)?.state?.role ?? "guest";
      } catch {
        return "guest";
      }
    });

    const modelsTab = authedPage.getByRole("link", { name: "Models" });
    const batchTab = authedPage.getByRole("link", { name: "Batch Sims" });
    const experimentsTab = authedPage.getByRole("link", {
      name: "Experiments",
    });

    if (role === "admin") {
      // Admin should see all tabs
      await expect(modelsTab).toBeVisible();
      await expect(batchTab).toBeVisible();
      await expect(experimentsTab).toBeVisible();
    } else {
      // Non-admin should not see admin tabs
      await expect(modelsTab).not.toBeVisible();
      await expect(batchTab).not.toBeVisible();
      await expect(experimentsTab).not.toBeVisible();
    }
  });

  test("analytics landing links to simulator", async ({ authedPage }) => {
    await authedPage.goto("/analytics");
    await waitForLoad(authedPage);

    const mlbCard = authedPage.getByRole("link", { name: /MLB/ });
    await expect(mlbCard).toBeVisible();
    await expect(mlbCard).toHaveAttribute("href", "/analytics/simulator");
  });
});
