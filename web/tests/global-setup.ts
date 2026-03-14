import { test as setup } from "@playwright/test";
import { loginViaUI, signupViaUI, AUTH_STATE_PATH } from "./helpers";
import fs from "fs";
import path from "path";

/**
 * Global setup — creates a test account and saves its auth state
 * so all other tests can load it without re-logging-in each time.
 */
setup("create test account and save auth state", async ({ page }) => {
  // Ensure .auth directory exists
  const dir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const email = `e2e-${Date.now()}@test.scrolldown.dev`;
  const password = "Test1234!secure";

  // Try to sign up; if the account already exists, log in instead
  try {
    await signupViaUI(page, email, password);
  } catch {
    await loginViaUI(page, email, password);
  }

  // Save authenticated state (cookies + localStorage)
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
