import { test as base, expect, type Page } from "@playwright/test";
import path from "path";

// Persistent auth state file (written by global-setup, loaded by tests)
export const AUTH_STATE_PATH = path.join(
  __dirname,
  ".auth",
  "user-state.json",
);

// ---------------------------------------------------------------------------
// Extended test fixture with common helpers
// ---------------------------------------------------------------------------

type Fixtures = {
  authedPage: Page;
};

export const test = base.extend<Fixtures>({
  /** A page that is already logged in (loads saved auth state). */
  authedPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: AUTH_STATE_PATH,
    });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback, not a React hook
    await use(page);
    await ctx.close();
  },
});

export { expect };

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Log in via the UI and return the page. */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Min 8 characters").fill(password);
  await page.locator('form button[type="submit"]').click();
  // Wait for redirect to home
  await page.waitForURL("/", { timeout: 10_000 });
}

/** Sign up via the UI and return the page. */
export async function signupViaUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login?tab=signup");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[placeholder="Min 8 characters"]').fill(password);
  await page.locator('input[placeholder="Re-enter password"]').fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("/", { timeout: 10_000 });
}

/** Wait for loading skeletons / spinners to disappear. */
export async function waitForLoad(page: Page): Promise<void> {
  // Wait for any animated pulse (skeleton) elements to disappear
  await page
    .locator(".animate-pulse")
    .first()
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {
      /* no skeletons is fine */
    });
}

/** Get the auth token from localStorage. */
export async function getAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("sd-auth");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.state?.token ?? null;
    } catch {
      return null;
    }
  });
}

/** Clear all app storage (logout without UI). */
export async function clearAppState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/** Wait for game rows to appear. Returns true if data loaded, false if not. */
export async function waitForGameData(page: Page, timeout = 15_000): Promise<boolean> {
  try {
    await page.locator("[data-testid='game-row']").first().waitFor({
      state: "visible",
      timeout,
    });
    return true;
  } catch {
    return false;
  }
}

/** Measure how long a navigation or action takes. */
export async function measureMs(fn: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}
