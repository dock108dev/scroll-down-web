import { test as setup } from "@playwright/test";
import { signupViaUI, AUTH_STATE_PATH } from "./helpers";
import fs from "fs";
import path from "path";

/**
 * Global setup — creates a test account and saves its auth state
 * so all other tests can load it without re-logging-in each time.
 */
setup("create test account and save auth state", async ({ page, request }) => {
  setup.setTimeout(120_000);
  // Ensure .auth directory exists
  const dir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const DEFAULT_SETTINGS = JSON.stringify({
    state: {
      theme: "system",
      scoreRevealMode: "onMarkRead",
      preferredSportsbook: "",
      oddsFormat: "american",
      autoResumePosition: true,
      homeExpandedSections: [],
      hideLimitedData: true,
      timelineDefaultTiers: [1, 2, 3],
      followingLive: false,
      followingLiveAt: 0,
    },
    version: 2,
  });

  // Check if backend is reachable before attempting signup
  let backendUp = false;
  try {
    const healthRes = await request.get("/api/health", { timeout: 15_000 });
    if (healthRes.ok()) {
      const body = await healthRes.json();
      backendUp = body.status === "ok";
    }
  } catch {
    // health endpoint unreachable
  }

  if (backendUp) {
    const email = `e2e-${Date.now()}@test.scrolldown.dev`;
    const password = "Test1234!secure";

    try {
      await signupViaUI(page, email, password);
    } catch {
      console.warn("[global-setup] Signup failed — saving empty auth state");
    }

    // Navigate to app so localStorage is accessible for seeding
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});

    try {
      await page.evaluate((settings: string) => {
        if (!localStorage.getItem("sd-settings")) {
          localStorage.setItem("sd-settings", settings);
        }
      }, DEFAULT_SETTINGS);
    } catch {
      console.warn("[global-setup] Could not seed localStorage via page.evaluate");
    }

    // Save authenticated state (cookies + localStorage)
    try {
      await page.context().storageState({ path: AUTH_STATE_PATH });
    } catch {
      fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
    }
  } else {
    console.warn("[global-setup] Backend unavailable — saving empty auth state");
    // Write auth state with seeded settings directly — no page navigation needed
    fs.writeFileSync(
      AUTH_STATE_PATH,
      JSON.stringify({
        cookies: [],
        origins: [
          {
            origin: "http://localhost:3001",
            localStorage: [{ name: "sd-settings", value: DEFAULT_SETTINGS }],
          },
        ],
      }),
    );
  }
});
