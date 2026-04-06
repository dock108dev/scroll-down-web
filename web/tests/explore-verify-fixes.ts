/**
 * Verify fixes from exploratory review — 2026-04-06
 * Run: cd web && npx tsx tests/explore-verify-fixes.ts
 */
import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3001";
const SCREENSHOT_DIR = path.resolve(__dirname, "../../docs/audit-results/screenshots");

async function shot(page: Page, name: string) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  Screenshot: ${name}`);
}

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

  // BUG-2: DegradedBanner text
  log("\n=== BUG-2: DegradedBanner text ===");
  await p.goto(BASE, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  const bannerEl = p.locator(".bg-yellow-500\\/10");
  if (await bannerEl.count() > 0) {
    const text = await bannerEl.textContent() ?? "";
    const hasCached = text.includes("Cached results may be shown");
    const hasUpdated = text.includes("Live scores and odds may not update");
    log(`  Old text ("Cached results..."): ${hasCached ? "STILL PRESENT ✗" : "REMOVED ✓"}`);
    log(`  New text ("Live scores..."): ${hasUpdated ? "PRESENT ✓" : "MISSING ✗"}`);
  } else {
    log("  Banner not visible (app may not be degraded)");
  }
  await shot(p, "explore-fixed-home-desktop");

  // BUG-3: FairBet ARIA tabs
  log("\n=== BUG-3: FairBet ARIA tabs ===");
  await p.goto(`${BASE}/fairbet`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
  const tablistCount = await p.locator('[role="tablist"]').count();
  const tabCount = await p.locator('[role="tab"]').count();
  const tabpanelCount = await p.locator('[role="tabpanel"]').count();
  log(`  role="tablist": ${tablistCount} ${tablistCount > 0 ? "✓" : "✗"}`);
  log(`  role="tab": ${tabCount} ${tabCount >= 2 ? "✓" : "✗"}`);
  log(`  role="tabpanel": ${tabpanelCount} ${tabpanelCount > 0 ? "✓" : "✗"}`);

  // Check aria-selected
  const selectedTab = await p.locator('[role="tab"][aria-selected="true"]').textContent().catch(() => "none");
  log(`  Selected tab: ${selectedTab}`);
  await shot(p, "explore-fixed-fairbet-desktop");

  // Click In-Game tab
  if (tabCount >= 2) {
    await p.locator('[role="tab"]').nth(1).click();
    await p.waitForTimeout(500);
    const selectedAfter = await p.locator('[role="tab"][aria-selected="true"]').textContent().catch(() => "none");
    log(`  After click, selected tab: ${selectedAfter}`);
    await shot(p, "explore-fixed-fairbet-desktop-tab2");
  }

  // BUG-1: Theme selector testid
  log("\n=== BUG-1: Theme selector testid ===");
  await p.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
  const themeSel = await p.locator('[data-testid="theme-selector"]').count();
  const radios = await p.locator('[data-testid="theme-selector"] [role="radio"]').count();
  log(`  data-testid="theme-selector": ${themeSel > 0 ? "FOUND ✓" : "MISSING ✗"}`);
  log(`  Radio buttons inside: ${radios} ${radios >= 3 ? "✓" : "✗"}`);
  await shot(p, "explore-fixed-settings-desktop");

  // UX-3: LIVE toggle degraded state
  log("\n=== UX-3: LIVE status badge (degraded) ===");
  await p.goto(BASE, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
  const liveButton = await p.locator('button:has-text("LIVE")').count();
  const liveSpan = await p.locator('span[aria-label*="unavailable"]').count();
  log(`  LIVE as <button> (toggle): ${liveButton} ${liveButton === 0 ? "✓ (not a toggle)" : "✗ (still a toggle)"}`);
  log(`  LIVE as <span> (badge): ${liveSpan} ${liveSpan > 0 ? "✓" : "(may not be visible)"}`);

  // UX-5: Settings collapsed
  log("\n=== UX-5: Settings sections collapsed ===");
  await p.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
  const scoreContent = await p.locator('text=Score visibility').isVisible().catch(() => false);
  const oddsContent = await p.locator('text=Default Book').isVisible().catch(() => false);
  log(`  "Score visibility" visible: ${scoreContent} ${!scoreContent ? "✓ (collapsed)" : "✗ (open)"}`);
  log(`  "Default Book" visible: ${oddsContent} ${!oddsContent ? "✓ (collapsed)" : "✗ (open)"}`);

  // UX-6: Analytics preview
  log("\n=== UX-6: Analytics preview samples ===");
  await p.goto(`${BASE}/analytics`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
  const yankees = await p.locator('text=Yankees vs Red Sox').count();
  const lakers = await p.locator('text=Lakers vs Celtics').count();
  const bruins = await p.locator('text=Bruins vs Rangers').count();
  const totalSamples = (yankees > 0 ? 1 : 0) + (lakers > 0 ? 1 : 0) + (bruins > 0 ? 1 : 0);
  log(`  Preview samples: ${totalSamples} ${totalSamples >= 3 ? "✓" : "✗"}`);
  log(`    Yankees: ${yankees > 0}, Lakers: ${lakers > 0}, Bruins: ${bruins > 0}`);
  await shot(p, "explore-fixed-analytics-desktop");

  // 404 page
  log("\n=== 404 page improvement ===");
  await p.goto(`${BASE}/nonexistent-xyz`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
  const text404 = await p.locator("body").textContent().catch(() => "");
  const hasPlayful = text404?.includes("play got called back");
  const hasArrow = text404?.includes("Back to Games");
  log(`  Playful copy: ${hasPlayful ? "✓" : "✗"}`);
  log(`  Back arrow: ${hasArrow ? "✓" : "✗"}`);
  await shot(p, "explore-fixed-404-desktop");

  await p.close();
  await ctx.close();

  // ─── Mobile context ───
  log("\n--- Mobile (390x844) ---");
  const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await mCtx.newPage();

  await mp.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await mp.waitForTimeout(500);
  await shot(mp, "explore-fixed-settings-mobile");

  await mp.goto(`${BASE}/fairbet`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await mp.waitForTimeout(500);
  await shot(mp, "explore-fixed-fairbet-mobile");

  await mp.goto(`${BASE}/nonexistent-xyz`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await mp.waitForTimeout(500);
  await shot(mp, "explore-fixed-404-mobile");

  await mp.goto(`${BASE}/analytics`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await mp.waitForTimeout(500);
  await shot(mp, "explore-fixed-analytics-mobile");

  await mp.goto(BASE, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await mp.waitForTimeout(500);
  await shot(mp, "explore-fixed-home-mobile");

  await mp.close();
  await mCtx.close();
  await browser.close();

  log("\n=== VERIFICATION COMPLETE ===");
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
