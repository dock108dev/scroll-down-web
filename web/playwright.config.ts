import { defineConfig, devices } from "@playwright/test";
import os from "os";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

/** Forward backend API key into the webServer child (CI + local); matches `src/lib/api-server.ts`. */
const SPORTS_API_KEY_ENV = (["SPORTS_DATA_API_KEY", "SPORTS_API_KEY", "API_KEY"] as const).reduce<
  Record<string, string>
>((acc, key) => {
  const v = process.env[key];
  if (v) acc[key] = v;
  return acc;
}, {});

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI runner is dedicated to this job — use full parallelism.
  workers: process.env.CI ? Math.max(1, os.availableParallelism()) : undefined,
  // Keep GitHub annotations, plus line-by-line progress in CI logs.
  reporter: process.env.CI ? [["github"], ["line"]] : "html",
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Auth setup — runs once, saves auth state for other tests
    {
      name: "setup",
      testMatch: /global-setup\.ts/,
    },

    // Desktop Chrome
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    // Mobile viewport (Chromium with mobile viewport to avoid needing WebKit installed)
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: process.env.CI ? "npm start" : "npm run dev",
    url: BASE_URL,
    // When something already listens on :3001, Playwright reuses it and this `env` is not applied.
    // For E2E then, set `SCROLLDOWN_PLAYWRIGHT_WEB_SERVER=1` in `web/.env.local` (never in production).
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_ADS_ENABLED: "false",
      // Enables `?tier=` overrides under `npm start` (production NODE_ENV); see `allowDevTierUrlOverrides`.
      NEXT_PUBLIC_SCROLLDOWN_E2E: "1",
      // Fast `/api/health` without WAN upstream (see `src/app/api/health/route.ts`)
      SCROLLDOWN_PLAYWRIGHT_WEB_SERVER: "1",
      MAGIC_LINK_SECRET:
        process.env.MAGIC_LINK_SECRET ||
        "scroll-down-local-playwright-default-magic-secret-key-48chars-x",
      ...SPORTS_API_KEY_ENV,
    },
  },
});
