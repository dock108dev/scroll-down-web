import { test as setup } from "@playwright/test";

// scroll-down-mlb has no auth/session/tier — global setup is a no-op kept
// only because playwright.config.ts wires it as the `setup` project.
setup("noop setup", async () => {
  /* nothing to do */
});
