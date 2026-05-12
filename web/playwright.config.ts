import { defineConfig, devices, type ReporterDescription } from "@playwright/test";
import os from "os";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const COLLECT_COVERAGE = process.env.SCROLLDOWN_E2E_COVERAGE === "1";

/** Forward backend API key into the webServer child (CI + local); matches `src/lib/api-server.ts`. */
const SPORTS_API_KEY_ENV = (["SPORTS_DATA_API_KEY", "SPORTS_API_KEY", "API_KEY"] as const).reduce<
  Record<string, string>
>((acc, key) => {
  const v = process.env[key];
  if (v) acc[key] = v;
  return acc;
}, {});

/**
 * Tags: tests or describes whose title includes `@live-upstream` need real upstream
 * sports payloads. PR CI runs `npx playwright test --grep "@smoke" --grep-invert "@live-upstream"`
 * (see `.github/workflows/ci.yml`). See `tests/SDA_HANDOFF.md`.
 */
function buildReporter(): ReporterDescription[] {
  const out: ReporterDescription[] = process.env.CI
    ? [["github"], ["line"]]
    : [["html", { open: "never" }]];
  if (COLLECT_COVERAGE) {
    out.push([
      "monocart-reporter",
      {
        name: "Scroll Down MLB E2E",
        outputFile: "./coverage-e2e/index.html",
        coverage: {
          outputDir: "./coverage-e2e",
          reports: [
            ["v8"],
            ["lcovonly", { file: "lcov.info" }],
            ["console-summary"],
          ],
          entryFilter: () => true,
          // Only count app-owned source files we can reasonably exercise from
          // the browser. Excludes inline <Script> bodies (which appear under
          // `localhost-3001/...`), api/route.ts (server-only), and the
          // top-level error boundary (only fires on uncaught render errors).
          sourceFilter: (sourcePath: string) => {
            if (sourcePath.startsWith("localhost-")) return false;
            if (!sourcePath.includes("/src/")) return false;
            if (sourcePath.includes("/api/")) return false;
            if (sourcePath.endsWith("/src/app/error.tsx")) return false;
            return (
              sourcePath.includes("/src/components/") ||
              sourcePath.includes("/src/hooks/") ||
              sourcePath.includes("/src/stores/") ||
              sourcePath.includes("/src/app/")
            );
          },
        },
      },
    ]);
  }
  return out;
}

export default defineConfig({
  testDir: "./tests",
  // tests/unit/** is run by Vitest (see vitest.config.ts); Playwright must skip it
  // or it'll try to load vitest's ESM entry under CJS and fail.
  testIgnore: ["**/unit/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI runner is dedicated to this job — use full parallelism.
  workers: process.env.CI ? Math.max(1, os.availableParallelism()) : undefined,
  // Keep GitHub annotations, plus line-by-line progress in CI logs.
  // When SCROLLDOWN_E2E_COVERAGE=1, add monocart-reporter to collect v8 JS
  // coverage and emit lcov + an HTML report. See tests/helpers.ts for the
  // matching per-test coverage fixture.
  reporter: buildReporter(),
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
      // Fast `/api/health` without WAN upstream (see `src/app/api/health/route.ts`)
      SCROLLDOWN_PLAYWRIGHT_WEB_SERVER: "1",
      ...SPORTS_API_KEY_ENV,
    },
  },
});
