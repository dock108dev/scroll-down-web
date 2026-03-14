import { test, expect, loginViaUI, clearAppState, getAuthToken } from '../helpers';

test.describe('Sign Up', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Click the "Sign Up" tab button
    await page.locator('button', { hasText: 'Sign Up' }).first().click();
  });

  test('sign up with valid credentials redirects to / and stores token', async ({ page }) => {
    const email = `test+${Date.now()}@example.com`;
    const password = 'ValidPass123!';

    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByPlaceholder('Re-enter password').fill(password);
    await page.locator('form button[type="submit"]').click();

    await page.waitForURL('/');

    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
  });

  test('sign up with short password shows validation error', async ({ page }) => {
    const email = `test+${Date.now()}@example.com`;

    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Min 8 characters').fill('short');
    await page.getByPlaceholder('Re-enter password').fill('short');
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('sign up with mismatched passwords shows error', async ({ page }) => {
    const email = `test+${Date.now()}@example.com`;

    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Min 8 characters').fill('ValidPass123!');
    await page.getByPlaceholder('Re-enter password').fill('DifferentPass456!');
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByText("Passwords don't match")).toBeVisible();
  });
});

test.describe('Log In', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('log in with valid credentials redirects to / and stores token', async ({ page }) => {
    // First create an account to log in with
    const email = `test+${Date.now()}@example.com`;
    const password = 'ValidPass123!';

    // Sign up first
    await page.locator('button', { hasText: 'Sign Up' }).first().click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByPlaceholder('Re-enter password').fill(password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/');

    // Log out
    await clearAppState(page);
    await page.goto('/login');

    // Log back in
    await loginViaUI(page, email, password);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
  });

  test('log in with wrong password shows error', async ({ page }) => {
    await page.getByPlaceholder('you@example.com').fill('testuser@example.com');
    await page.getByPlaceholder('Min 8 characters').fill('WrongPassword99!');
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});

test.describe('Session Persistence', () => {
  test('token persists after page reload', async ({ page }) => {
    const email = `test+${Date.now()}@example.com`;
    const password = 'ValidPass123!';

    // Sign up
    await page.goto('/login');
    await page.locator('button', { hasText: 'Sign Up' }).first().click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByPlaceholder('Re-enter password').fill(password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/');

    const tokenBefore = await getAuthToken(page);
    expect(tokenBefore).toBeTruthy();

    await page.reload();

    const tokenAfter = await getAuthToken(page);
    expect(tokenAfter).toBeTruthy();
    expect(tokenAfter).toBe(tokenBefore);
  });
});

test.describe('Logout', () => {
  test('logout via profile clears token and shows Log In link', async ({ page }) => {
    const email = `test+${Date.now()}@example.com`;
    const password = 'ValidPass123!';

    // Sign up
    await page.goto('/login');
    await page.locator('button', { hasText: 'Sign Up' }).first().click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByPlaceholder('Re-enter password').fill(password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/');

    await page.goto('/profile');
    await page.getByRole('button', { name: /log\s*out/i }).click();

    const token = await getAuthToken(page);
    expect(token).toBeFalsy();
  });
});
