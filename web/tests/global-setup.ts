import { test as setup } from "@playwright/test";
import { signupViaUI, AUTH_STATE_PATH } from "./helpers";
import fs from "fs";
import path from "path";

const ORIGIN = "http://localhost:3001";

function writeSeededAuthState(settingsJson: string, authJson: string): void {
  const dir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    AUTH_STATE_PATH,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: ORIGIN,
          localStorage: [
            { name: "sd-settings", value: settingsJson },
            { name: "sd-auth", value: authJson },
          ],
        },
      ],
    }),
  );
}

/**
 * Global setup — creates a test account when real signup works; otherwise
 * writes deterministic localStorage so `authedPage` is never an empty storage file.
 */
setup("create test account and save auth state", async ({ page, request }) => {
  setup.setTimeout(120_000);

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

  const DEFAULT_AUTH = JSON.stringify({
    state: {
      token: "e2e-fake-token",
      role: "user",
      email: "e2e@test.scrolldown.dev",
      userId: null,
      isLoading: false,
    },
    version: 0,
  });

  let backendUp = false;
  try {
    const healthRes = await request.get("/api/health", { timeout: 15_000 });
    if (healthRes.ok()) {
      const body = (await healthRes.json()) as { status?: string };
      backendUp = body.status === "ok";
    }
  } catch {
    // health endpoint unreachable
  }

  if (!backendUp) {
    console.warn("[global-setup] Backend unavailable — saving seeded auth state (localStorage only)");
    writeSeededAuthState(DEFAULT_SETTINGS, DEFAULT_AUTH);
    return;
  }

  const email = `e2e-${Date.now()}@test.scrolldown.dev`;
  const password = "Test1234!secure";

  let signupOk = false;
  try {
    await signupViaUI(page, email, password);
    signupOk = true;
  } catch {
    console.warn(
      "[global-setup] Signup failed — saving seeded auth state (localStorage only)",
    );
  }

  if (!signupOk) {
    writeSeededAuthState(DEFAULT_SETTINGS, DEFAULT_AUTH);
    return;
  }

  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});

  try {
    await page.evaluate(
      ({ settings, auth }: { settings: string; auth: string }) => {
        if (!localStorage.getItem("sd-settings")) {
          localStorage.setItem("sd-settings", settings);
        }
        if (!localStorage.getItem("sd-auth")) {
          localStorage.setItem("sd-auth", auth);
        }
      },
      { settings: DEFAULT_SETTINGS, auth: DEFAULT_AUTH },
    );
  } catch {
    console.warn("[global-setup] Could not seed localStorage via page.evaluate");
  }

  try {
    await page.context().storageState({ path: AUTH_STATE_PATH });
  } catch {
    console.warn("[global-setup] storageState failed — falling back to seeded auth state");
    writeSeededAuthState(DEFAULT_SETTINGS, DEFAULT_AUTH);
  }
});
