import { test, expect } from '../helpers';

test.describe('Magic Link - Login Tab', () => {
  test('"Send me a sign-in link" button is visible on login tab', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('button', { name: /send me a sign-in link/i }),
    ).toBeVisible();
  });

  test('"Send me a sign-in link" button is not visible on signup tab', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button', { hasText: 'Sign Up' }).first().click();

    await expect(
      page.getByRole('button', { name: /send me a sign-in link/i }),
    ).not.toBeVisible();
  });

  test('clicking with valid email shows confirmation message', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('you@example.com').fill('testuser@example.com');
    await page.getByRole('button', { name: /send me a sign-in link/i }).click();

    await expect(page.getByText(/check your email for a sign-in link/i)).toBeVisible();
  });

  test('clicking with no email shows validation error', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /send me a sign-in link/i }).click();

    await expect(page.getByText('Enter a valid email address')).toBeVisible();
  });
});

test.describe('Magic Link - Verification Page', () => {
  test('/auth/magic-link with no token shows invalid link', async ({ page }) => {
    await page.goto('/auth/magic-link');

    await expect(page.getByRole('heading', { name: /invalid link/i })).toBeVisible();
  });

  test('/auth/magic-link with bad token shows error state', async ({ page }) => {
    await page.goto('/auth/magic-link?token=badtoken');

    // Initially shows the loading state, then resolves to an error
    await expect(
      page.getByRole('heading', { name: /link expired|invalid/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
