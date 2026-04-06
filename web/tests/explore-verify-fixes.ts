/**
 * Verify fixes for exploratory findings from 2026-04-04.
 * Run: cd web && npx tsx tests/explore-verify-fixes.ts
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3001";
const SCREENSHOT_DIR = path.resolve(__dirname, "../../docs/audit-results/screenshots");

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results: string[] = [];

  function log(msg: string) {
    console.log(msg);
    results.push(msg);
  }

  // ─── Desktop context ───
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();

  // TEST 1: Degraded banner visible
  log("\n=== TEST 1: Degraded Banner ===");
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(3000);
  const bannerText = await p.locator('text=/temporarily unavailable|Limited/i').count();
  log(`  Degraded banner visible: ${bannerText > 0 ? "YES ✓" : "NO ✗"}`);
  await p.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-degraded-banner.png"), fullPage: false });

  // TEST 2: Dark mode shows error state (not stuck on loading)
  log("\n=== TEST 2: Dark Mode Error States ===");
  await p.emulateMedia({ colorScheme: "dark" });

  // Home dark
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(4000);
  const homeHasError = await p.locator('text=/trouble|retry|unavailable/i').count();
  const homeHasLoading = await p.locator('text=/loading/i').count();
  log(`  Home dark — error state: ${homeHasError > 0 ? "YES ✓" : "NO ✗"}, stuck loading: ${homeHasLoading > 0 ? "YES ✗" : "NO ✓"}`);
  await p.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-home-dark.png"), fullPage: true });

  // Golf dark
  await p.goto(`${BASE}/golf`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(4000);
  const golfHasError = await p.locator('text=/trouble|retry|unavailable/i').count();
  const golfHasLoading = await p.locator('text=/Loading tournaments/i').count();
  log(`  Golf dark — error state: ${golfHasError > 0 ? "YES ✓" : "NO ✗"}, stuck loading: ${golfHasLoading > 0 ? "YES ✗" : "NO ✓"}`);
  await p.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-golf-dark.png"), fullPage: true });

  // FairBet dark
  await p.goto(`${BASE}/fairbet`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(4000);
  const fbHasError = await p.locator('text=/trouble|retry|unavailable/i').count();
  const fbHasLoading = await p.locator('text=/Loading bets/i').count();
  log(`  FairBet dark — error state: ${fbHasError > 0 ? "YES ✓" : "NO ✗"}, stuck loading: ${fbHasLoading > 0 ? "YES ✗" : "NO ✓"}`);
  await p.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-fairbet-dark.png"), fullPage: true });

  // TEST 3: Settings ARIA roles
  log("\n=== TEST 3: Settings ARIA Roles ===");
  await p.emulateMedia({ colorScheme: "light" });
  await p.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(2000);

  const switches = await p.locator('[role="switch"]').count();
  const checkboxes = await p.locator('[role="checkbox"]').count();
  const radiogroups = await p.locator('[role="radiogroup"]').count();
  const radios = await p.locator('[role="radio"]').count();
  log(`  role="switch": ${switches} ${switches > 0 ? "✓" : "✗"}`);
  log(`  role="checkbox": ${checkboxes} ${checkboxes > 0 ? "✓" : "✗"}`);
  log(`  role="radiogroup": ${radiogroups} ${radiogroups > 0 ? "✓" : "✗"}`);
  log(`  role="radio": ${radios} ${radios > 0 ? "✓" : "✗"}`);
  await p.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-settings-aria.png"), fullPage: true });

  // Expand collapsible sections to find all controls
  const sectionButtons = await p.locator('button[aria-expanded="false"]').all();
  for (const btn of sectionButtons) {
    await btn.click({ timeout: 2000 }).catch(() => {});
    await p.waitForTimeout(300);
  }
  const switchesExpanded = await p.locator('[role="switch"]').count();
  const checkboxesExpanded = await p.locator('[role="checkbox"]').count();
  log(`  After expanding all sections — switches: ${switchesExpanded}, checkboxes: ${checkboxesExpanded}`);
  await p.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-settings-expanded.png"), fullPage: true });

  await ctx.close();
  await browser.close();

  // Summary
  log("\n=== VERIFICATION COMPLETE ===\n");
  console.log(results.join("\n"));
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
