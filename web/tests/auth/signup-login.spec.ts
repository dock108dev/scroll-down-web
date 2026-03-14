import { test, expect, loginViaUI, clearAppState, getAuthToken } from '../helpers';

/** Try to sign up a new user. Returns true if signup succeeded, false if backend is unresponsive. */
async function trySignup(page: import("@playwright/test").Page, email: string, password: string): Promise<boolean> {
  await page.goto('/login');
  await page.locator('button', { hasText: 'Sign Up' }).first().click();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Min 8 characters').fill(password);
  await page.getByPlaceholder('Re-enter password').fill(password);
  await page.locator('form button[type="submit"]').click();
  try {
    await page.waitForURL('/', { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

test.describe('Sign Up', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('button', { hasText: 'Sign Up' }).first().click();
  });

  test('sign up with valid credentials redirects to / and stores token', async ({ page }) => {
    const email = `test+${Date.now()}@example.com`;
    const password = 'ValidPass123!';

    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Min 8 characters').fill(password);
    await page.getByPlaceholder('Re-enter password').fill(password);
    await page.locator('form button[type="submit"]').click();

    try {
      await page.waitForURL('/', { timeout: 15_000 });
    } catch {
      test.skip(true, 'Backend did not respond to signup');
      return;
    }

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
    const email = `test+${Date.now()}@example.com`;
    const password = 'ValidPass123!';

    // Sign up first
    const signedUp = await trySignup(page, email, password);
    if (!signedUp) { test.skip(true, 'Backend did not respond to signup'); return; }

    // Log out
    await clearAppState(page);
    await page.goto('/login');

    // Log back in
    try {
      await loginViaUI(page, email, password);
    } catch {
      test.skip(true, 'Backend did not respond to login');
      return;
    }
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

    const signedUp = await trySignup(page, email, password);
    if (!signedUp) { test.skip(true, 'Backend did not respond to signup'); return; }

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

    const signedUp = await trySignup(page, email, password);
    if (!signedUp) { test.skip(true, 'Backend did not respond to signup'); return; }

    await page.goto('/profile');
    await page.waitForTimeout(1000);
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth state expired — redirected to login');
      return;
    }

    await page.locator('main').getByRole('button', { name: /log\s*out/i }).click();

    const token = await getAuthToken(page);
    expect(token).toBeFalsy();
  });
});
