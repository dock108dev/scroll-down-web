import { test, expect } from '../helpers';

test.describe('Forgot Password', () => {
  test('forgot password link is visible on login tab', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
  });

  test('forgot password link is not visible on signup tab', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button', { hasText: 'Sign Up' }).first().click();
    await expect(page.getByRole('link', { name: /forgot password/i })).not.toBeVisible();
  });

  test('submit forgot password with email shows confirmation', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByPlaceholder('you@example.com').fill('testuser@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
  });

  test('submit forgot password with empty email shows validation error', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByRole('button', { name: /send reset link/i }).click();

    // App validates with JS — shows error text
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
  });
});

test.describe('Reset Password', () => {
  test('reset password page with no token shows invalid link', async ({ page }) => {
    await page.goto('/reset-password');

    await expect(page.getByText(/invalid link/i)).toBeVisible();
  });

  test('reset password with mismatched passwords shows error', async ({ page }) => {
    await page.goto('/reset-password?token=sometoken');

    await page.getByPlaceholder('Min 8 characters').fill('NewPassword123!');
    await page.getByPlaceholder('Re-enter password').fill('DifferentPassword456!');
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByText("Passwords don't match")).toBeVisible();
  });

  test('reset password page has link to request a new reset', async ({ page }) => {
    await page.goto('/reset-password?token=sometoken');

    await expect(
      page.getByRole('link', { name: /request a new reset link/i }),
    ).toBeVisible();
  });
});
