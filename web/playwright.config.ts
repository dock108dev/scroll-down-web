import { defineConfig, devices } from "@playwright/test";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
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

    // Audit project — always captures screenshots/video, no retries
    {
      name: "audit",
      testMatch: /audit\/.+\.spec\.ts/,
      testIgnore: /audit\/api-stress\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        screenshot: "on",
        video: "on",
      },
      retries: 0,
      dependencies: ["setup"],
    },

    // Stress tests run after main audit to avoid rate-limiting other tests
    {
      name: "audit-stress",
      testMatch: /audit\/api-stress\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        screenshot: "on",
        video: "on",
      },
      retries: 0,
      dependencies: ["audit"],
    },
  ],

  webServer: {
    command: process.env.CI ? "npm start" : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
