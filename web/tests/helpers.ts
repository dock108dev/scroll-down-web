import { test as base, expect, type Page } from "@playwright/test";

export const test = base;
export { expect };

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Wait for loading skeletons / spinners to disappear. */
export async function waitForLoad(page: Page): Promise<void> {
  await page
    .locator(".animate-pulse")
    .first()
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {
      /* no skeletons is fine */
    });
}

/** Clear all app storage (reset persisted reveal/settings/etc). */
export async function clearAppState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/** Scroll a locator's element to viewport center via window.scrollBy, then
 *  click. Use when the page has a tall sticky header AND fixed bottom tabs. */
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
    const delay = baseDelayMs * Math.pow(2, i);
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
