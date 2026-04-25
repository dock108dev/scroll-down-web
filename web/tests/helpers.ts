import { test as base, expect, type Page } from "@playwright/test";
import path from "path";

// Persistent auth state files (written by global-setup, loaded by tests).
// One file per identity so tests don't fight over a single mutable session.
export const AUTH_STATE_PATH = path.join(
  __dirname,
  ".auth",
  "user-state.json",
);
export const PRO_STATE_PATH = path.join(
  __dirname,
  ".auth",
  "pro-state.json",
);
export const ADMIN_STATE_PATH = path.join(
  __dirname,
  ".auth",
  "admin-state.json",
);

// ---------------------------------------------------------------------------
// Extended test fixture with common helpers
// ---------------------------------------------------------------------------

type Fixtures = {
  /** Logged-in free-tier user (role=user). */
  authedPage: Page;
  /** Logged-in pro-tier user. Use for FairBet pro-only UI, EV simulator, Monte Carlo, etc. */
  proPage: Page;
  /** Logged-in admin user (free tier unless you change it). Use for /history admin checks. */
  adminPage: Page;
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
  /** A pro-tier authenticated page. Session JWT carries tier=pro and `sd-tier`
   *  cookie is "pro", so `useSession()`, `useIsPro()`, and Pro UI branches
   *  all see the user as Pro without needing `?tier=pro` URL overrides. */
  proPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: PRO_STATE_PATH,
    });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback, not a React hook
    await use(page);
    await ctx.close();
  },
  /** An admin-role authenticated page. `useAuth.role` is "admin" (read by
   *  /history and admin analytics gates). Tier defaults to free. */
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: ADMIN_STATE_PATH,
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

/** `window.__openProGateSheet` is assigned in layout; wait so `page.goto` does not race it. */
export async function waitForProGateTestHook(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __openProGateSheet?: unknown }).__openProGateSheet ===
      "function",
    { timeout: 15_000 },
  );
}

/** Tier persist seeds `sd-tier` in localStorage after async rehydration. */
export async function waitForTierPersist(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem("sd-tier");
      if (!raw) return false;
      try {
        const anonId = JSON.parse(raw)?.state?.anonId;
        return typeof anonId === "string" && anonId.length > 0;
      } catch {
        return false;
      }
    },
    { timeout: 15_000 },
  );
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

/** Scroll a locator's element to viewport center via window.scrollBy, then
 *  click. Use when the page has a tall sticky header AND fixed bottom tabs
 *  — Playwright's auto-scroll can land the target under either overlay,
 *  especially on mobile viewport (390×844). */
export async function scrollCenterAndClick(
  locator: { evaluate: (fn: (el: Element) => void) => Promise<void>; click: (opts?: object) => Promise<void> },
  options?: { timeout?: number },
): Promise<void> {
  await locator.evaluate((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const target = window.innerHeight / 2;
    window.scrollBy({ top: center - target, behavior: "instant" });
  });
  await locator.click(options ?? {});
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

/** Fetch with automatic retry on 429 rate-limit responses using exponential backoff. */
export async function fetchWithRetry(
  request: { get: (url: string, opts?: { timeout?: number }) => Promise<{ status: () => number; json: () => Promise<unknown>; ok: () => boolean; text: () => Promise<string> }> },
  url: string,
  retries = 2,
  baseDelayMs = 1_500,
): Promise<{ status: () => number; json: () => Promise<unknown>; ok: () => boolean; text: () => Promise<string> }> {
  let res = await request.get(url, { timeout: 30_000 });
  for (let i = 0; i < retries && (res.status() === 429 || res.status() === 500); i++) {
    const delay = baseDelayMs * Math.pow(2, i); // 1.5s, 3s
    await new Promise((r) => setTimeout(r, delay));
    res = await request.get(url, { timeout: 30_000 });
  }
  return res;
}

/** Measure how long a navigation or action takes. */
export async function measureMs(fn: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}

