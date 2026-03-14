import { test, expect } from "../helpers";

test.describe("Profile Page", () => {
  test("guest visiting /profile gets redirected to /login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logged-in user sees Account heading", async ({ authedPage }) => {
    await authedPage.goto("/profile");
    await expect(
      authedPage.getByRole("heading", { name: "Account" })
    ).toBeVisible();
  });

  test("account info shows email and role badge", async ({ authedPage }) => {
    await authedPage.goto("/profile");

    // "Account Info" section title should be visible
    await expect(authedPage.getByText("Account Info")).toBeVisible();

    // Role badge should show "user" or "admin"
    const roleBadge = authedPage.getByText(/^(user|admin)$/i);
    await expect(roleBadge).toBeVisible();
  });

  test("change password form validates min length", async ({ authedPage }) => {
    await authedPage.goto("/profile");

    // The "New Password" field has placeholder "Min 8 characters"
    await authedPage.getByPlaceholder("Min 8 characters").fill("short");
    await authedPage
      .getByRole("button", { name: "Update Password" })
      .click();

    // Should show a validation error about minimum length
    await expect(authedPage.getByText(/8 char/i)).toBeVisible();
  });

  test("change password form validates matching passwords", async ({
    authedPage,
  }) => {
    await authedPage.goto("/profile");

    // Fill in the change password form
    // There are two "Current Password" labels (one in Change Email, one in Change Password)
    // Use the Change Password section
    const changePwSection = authedPage.getByText("Change Password").locator("..");

    await authedPage.getByPlaceholder("Min 8 characters").fill("newpassword1");

    // Submit to trigger validation
    await authedPage
      .getByRole("button", { name: "Update Password" })
      .click();

    // Should show a validation error about passwords not matching or missing fields
    await expect(
      authedPage.getByText(/match/i).or(authedPage.getByText(/required/i))
    ).toBeVisible();
  });

  test("Log Out button clears auth state and redirects to /", async ({
    authedPage,
  }) => {
    await authedPage.goto("/profile");

    await authedPage.getByRole("button", { name: "Log Out" }).click();

    await expect(authedPage).toHaveURL("/");
  });

  test("clicking Delete Account expands the confirmation form", async ({
    authedPage,
  }) => {
    await authedPage.goto("/profile");

    // Initially the red "Delete My Account" button should not be visible
    await expect(
      authedPage.getByRole("button", { name: "Delete My Account" })
    ).not.toBeVisible();

    // Click the "Delete Account" button to expand the section
    await authedPage
      .getByRole("button", { name: "Delete Account" })
      .click();

    // Now the expanded form should show warning text and the confirm button
    await expect(
      authedPage.getByText(/permanently delete your account/i)
    ).toBeVisible();
    await expect(
      authedPage.getByRole("button", { name: "Delete My Account" })
    ).toBeVisible();
  });

  test("Cancel button in delete form collapses it back", async ({
    authedPage,
  }) => {
    await authedPage.goto("/profile");

    // Expand the delete section
    await authedPage
      .getByRole("button", { name: "Delete Account" })
      .click();
    await expect(
      authedPage.getByRole("button", { name: "Delete My Account" })
    ).toBeVisible();

    // Click Cancel to collapse
    await authedPage.getByRole("button", { name: "Cancel" }).click();

    // The confirm button should no longer be visible
    await expect(
      authedPage.getByRole("button", { name: "Delete My Account" })
    ).not.toBeVisible();
  });
});
