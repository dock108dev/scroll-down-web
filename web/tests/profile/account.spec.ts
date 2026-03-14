import { test, expect } from "../helpers";
import type { Page } from "@playwright/test";

/** Navigate to /profile and verify auth is valid. Returns false if redirected to login. */
async function gotoProfileOrSkip(page: Page): Promise<boolean> {
  await page.goto("/profile");
  await page.waitForLoadState("networkidle");
  return !page.url().includes("/login");
}

test.describe("Profile Page", () => {
  // Scope selectors to main to avoid duplicates from settings drawer
  const main = "main";

  test("guest visiting /profile gets redirected to /login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logged-in user sees Account heading", async ({ authedPage }) => {
    const onProfile = await gotoProfileOrSkip(authedPage);
    if (!onProfile) { test.skip(true, "Auth state expired"); return; }
    await expect(
      authedPage.locator(main).getByRole("heading", { name: "Account", exact: true }).first()
    ).toBeVisible();
  });

  test("account info shows email and role badge", async ({ authedPage }) => {
    const onProfile = await gotoProfileOrSkip(authedPage);
    if (!onProfile) { test.skip(true, "Auth state expired"); return; }
    const container = authedPage.locator(main);

    await expect(container.getByText("Account Info")).toBeVisible();

    const roleBadge = container.getByText(/^(user|admin)$/i).first();
    await expect(roleBadge).toBeVisible();
  });

  test("change password form validates min length", async ({ authedPage }) => {
    const onProfile = await gotoProfileOrSkip(authedPage);
    if (!onProfile) { test.skip(true, "Auth state expired"); return; }
    const container = authedPage.locator(main);

    await container.getByPlaceholder("Min 8 characters").fill("short");
    await container
      .getByRole("button", { name: "Update Password" })
      .click();

    await expect(container.getByText(/8 char/i)).toBeVisible();
  });

  test("change password form validates matching passwords", async ({
    authedPage,
  }) => {
    const onProfile = await gotoProfileOrSkip(authedPage);
    if (!onProfile) { test.skip(true, "Auth state expired"); return; }
    const container = authedPage.locator(main);

    await container.getByPlaceholder("Min 8 characters").fill("newpassword1");

    await container
      .getByRole("button", { name: "Update Password" })
      .click();

    await expect(
      container.getByText(/match/i).or(container.getByText(/required/i))
    ).toBeVisible();
  });

  test("Log Out button clears auth state and redirects", async ({
    authedPage,
  }) => {
    const onProfile = await gotoProfileOrSkip(authedPage);
    if (!onProfile) { test.skip(true, "Auth state expired"); return; }

    await Promise.all([
      authedPage.waitForURL(/\/(login)?$/, { timeout: 10_000 }),
      authedPage.locator(main).getByRole("button", { name: "Log Out" }).click(),
    ]);

    expect(authedPage.url()).toMatch(/\/(login)?$/);
  });

  test("clicking Delete Account expands the confirmation form", async ({
    authedPage,
  }) => {
    const onProfile = await gotoProfileOrSkip(authedPage);
    if (!onProfile) { test.skip(true, "Auth state expired"); return; }
    const container = authedPage.locator(main);

    await expect(
      container.getByRole("button", { name: "Delete My Account" })
    ).not.toBeVisible();

    await container
      .getByRole("button", { name: "Delete Account" })
      .click();

    await expect(
      container.getByText(/permanently delete your account/i)
    ).toBeVisible();
    await expect(
      container.getByRole("button", { name: "Delete My Account" })
    ).toBeVisible();
  });

  test("Cancel button in delete form collapses it back", async ({
    authedPage,
  }) => {
    const onProfile = await gotoProfileOrSkip(authedPage);
    if (!onProfile) { test.skip(true, "Auth state expired"); return; }
    const container = authedPage.locator(main);

    await container
      .getByRole("button", { name: "Delete Account" })
      .click();
    await expect(
      container.getByRole("button", { name: "Delete My Account" })
    ).toBeVisible();

    await container.getByRole("button", { name: "Cancel" }).click();

    await expect(
      container.getByRole("button", { name: "Delete My Account" })
    ).not.toBeVisible();
  });
});
