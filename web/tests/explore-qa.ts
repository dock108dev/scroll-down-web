/**
 * Exploratory QA Script — 2026-04-04
 * Browses the live app like a real sports fan, takes screenshots, collects observations.
 * Run: cd web && npx tsx tests/explore-qa.ts
 */
import { chromium, ConsoleMessage } from "playwright";
import type { Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3001";
const SCREENSHOT_DIR = path.resolve(__dirname, "../../docs/audit-results/screenshots");

interface Observation {
  type: "bug" | "ux" | "visual" | "data" | "perf" | "feature";
  severity: "low" | "medium" | "high" | "critical";
  page: string;
  description: string;
  screenshot?: string;
}

const observations: Observation[] = [];
const consoleErrors: { page: string; message: string }[] = [];

function screenshotPath(name: string) {
  return path.join(SCREENSHOT_DIR, `explore-qa-${name}.png`);
}

async function shot(page: Page, name: string) {
  const p = screenshotPath(name);
  await page.screenshot({ path: p, fullPage: true });
  return `explore-qa-${name}.png`;
}

function observe(obs: Observation) {
  observations.push(obs);
  console.log(`[${obs.type.toUpperCase()}] ${obs.severity}: ${obs.description} (${obs.page})`);
}

function collectConsole(page: Page, pageName: string) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      consoleErrors.push({ page: pageName, message: msg.text().slice(0, 300) });
    }
  });
}

async function checkOverflow(page: Page, pageName: string) {
  const overflow = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
  if (overflow) {
    observe({ type: "visual", severity: "medium", page: pageName, description: "Horizontal overflow on page body" });
  }
}

async function measureLoad(page: Page, url: string, label: string) {
  const start = Date.now();
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000); // let JS render
  const elapsed = Date.now() - start;
  const status = resp?.status() ?? 0;
  console.log(`  ${label}: ${elapsed}ms (status ${status})`);
  if (status >= 400 && status !== 404) {
    observe({ type: "bug", severity: "high", page: label, description: `Page returned HTTP ${status}` });
  }
  if (elapsed > 5000) {
    observe({ type: "perf", severity: "medium", page: label, description: `Slow load: ${elapsed}ms` });
  }
  return { elapsed, status };
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // ========== DESKTOP (1280x720) ==========
  console.log("\n=== DESKTOP SESSION (1280x720) ===\n");
  const dCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  let p = await dCtx.newPage();
  collectConsole(p, "desktop");

  // HOME
  await measureLoad(p, BASE, "/");
  await shot(p, "home-desktop");
  await checkOverflow(p, "/");

  const cardCount = await p.locator('a[href*="/game"]').count();
  console.log(`  Game links on home: ${cardCount}`);
  if (cardCount === 0) {
    const hasError = await p.locator('[role="alert"], [class*="error" i], [class*="Error"]').count();
    const hasEmpty = await p.locator('text=/no games|no data|nothing/i').count();
    if (hasError > 0) observe({ type: "data", severity: "high", page: "/", description: "Home showing error state" });
    else if (hasEmpty > 0) observe({ type: "data", severity: "medium", page: "/", description: "Home showing empty state" });
    else observe({ type: "data", severity: "medium", page: "/", description: "No game links found on home page" });
  }

  // Scroll
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(500);
  await shot(p, "home-desktop-scrolled");

  // Sport tabs
  const sportTabs = await p.locator('[role="tab"], button:has-text("MLB"), button:has-text("NBA"), button:has-text("NHL")').all();
  console.log(`  Sport filter tabs: ${sportTabs.length}`);
  if (sportTabs.length > 1) {
    await sportTabs[1].click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(1000);
    await shot(p, "home-desktop-filtered");
  }

  // Click a game -> detail
  const gameLinks = await p.locator('a[href*="/game"]').all();
  if (gameLinks.length > 0) {
    const href = await gameLinks[0].getAttribute("href");
    console.log(`  Clicking game: ${href}`);
    await gameLinks[0].click({ timeout: 5000 });
    await p.waitForTimeout(2000);
    const detailUrl = p.url();
    await shot(p, "game-detail-desktop");
    await checkOverflow(p, detailUrl);

    // Back button check
    const hasBack = await p.locator('[aria-label*="back" i], button:has-text("Back"), a:has-text("Back")').count();
    if (hasBack === 0) {
      observe({ type: "ux", severity: "low", page: detailUrl, description: "No back button on game detail" });
    }
    await p.goBack({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
  }

  // GOLF
  await measureLoad(p, `${BASE}/golf`, "/golf");
  await shot(p, "golf-desktop");
  await checkOverflow(p, "/golf");
  const golfRows = await p.locator('table tr, [class*="player"], [class*="leaderboard"]').count();
  console.log(`  Golf rows: ${golfRows}`);

  const golfEventLinks = await p.locator('a[href*="/golf/"]').all();
  if (golfEventLinks.length > 0) {
    await golfEventLinks[0].click({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(2000);
    await shot(p, "golf-event-desktop");
    await checkOverflow(p, p.url());
    await p.goBack({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
  }

  // FAIRBET
  await measureLoad(p, `${BASE}/fairbet`, "/fairbet");
  await shot(p, "fairbet-desktop");
  await checkOverflow(p, "/fairbet");

  const fbTabs = await p.locator('[role="tab"]').all();
  if (fbTabs.length > 1) {
    await fbTabs[1].click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(1000);
    await shot(p, "fairbet-desktop-tab2");
  }
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(500);
  await shot(p, "fairbet-desktop-scrolled");

  // LOGIN
  await measureLoad(p, `${BASE}/login`, "/login");
  await shot(p, "login-desktop");
  await checkOverflow(p, "/login");

  // Submit empty
  const submitBtn = p.locator('button[type="submit"]').first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(1000);
    await shot(p, "login-desktop-empty-submit");
    const validations = await p.locator('[class*="error" i], [class*="validation" i], [role="alert"], .text-red-500, .text-destructive').count();
    if (validations === 0) {
      observe({ type: "ux", severity: "medium", page: "/login", description: "No validation on empty form submit" });
    }
  }

  // Invalid email
  const emailInput = p.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.count() > 0) {
    await emailInput.fill("bad-email");
    await p.locator('input[type="password"]').first().fill("x").catch(() => {});
    await submitBtn.click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(1000);
    await shot(p, "login-desktop-invalid");
  }

  // Forgot password link
  const forgotPw = await p.locator('a:has-text("Forgot"), button:has-text("Forgot")').count();
  console.log(`  Forgot password link: ${forgotPw > 0 ? "yes" : "no"}`);

  // SETTINGS
  await measureLoad(p, `${BASE}/settings`, "/settings");
  await shot(p, "settings-desktop");
  await checkOverflow(p, "/settings");

  const toggles = await p.locator('[role="switch"], [class*="Switch"]').all();
  console.log(`  Settings toggles: ${toggles.length}`);
  if (toggles.length > 0) {
    await toggles[0].click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(500);
    await shot(p, "settings-desktop-toggled");
  }

  // PROFILE
  await measureLoad(p, `${BASE}/profile`, "/profile");
  console.log(`  Profile redirected to: ${p.url()}`);
  await shot(p, "profile-desktop");

  // ANALYTICS
  await measureLoad(p, `${BASE}/analytics`, "/analytics");
  await shot(p, "analytics-desktop");
  await checkOverflow(p, "/analytics");

  // HISTORY
  await measureLoad(p, `${BASE}/history`, "/history");
  await shot(p, "history-desktop");
  await checkOverflow(p, "/history");

  // 404
  await p.goto(`${BASE}/nonexistent-page-xyz`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await shot(p, "404-desktop");
  const has404 = await p.locator('text=/not found|404/i').count();
  if (has404 === 0) {
    observe({ type: "ux", severity: "medium", page: "/404", description: "No clear 404 message" });
  }

  // DARK MODE
  await p.emulateMedia({ colorScheme: "dark" });
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(4000); // wait for API response + error state render
  await shot(p, "home-desktop-dark");
  await p.goto(`${BASE}/fairbet`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(4000);
  await shot(p, "fairbet-desktop-dark");
  await p.goto(`${BASE}/golf`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(4000);
  await shot(p, "golf-desktop-dark");
  await p.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(2000);
  await shot(p, "settings-desktop-dark");

  await dCtx.close();

  // ========== MOBILE (390x844) ==========
  console.log("\n=== MOBILE SESSION (390x844) ===\n");
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  p = await mCtx.newPage();
  collectConsole(p, "mobile");

  // MOBILE HOME
  await measureLoad(p, BASE, "/ (mobile)");
  await shot(p, "home-mobile");
  await checkOverflow(p, "/ (mobile)");
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(500);
  await shot(p, "home-mobile-scrolled");

  // Tap game
  const mGameLinks = await p.locator('a[href*="/game"]').all();
  if (mGameLinks.length > 0) {
    await mGameLinks[0].tap({ timeout: 5000 }).catch((e: unknown) => {
      observe({ type: "bug", severity: "medium", page: "/ (mobile)", description: `Game card tap failed: ${e instanceof Error ? e.message.slice(0, 100) : String(e)}` });
    });
    await p.waitForTimeout(2000);
    await shot(p, "game-detail-mobile");
    await checkOverflow(p, `${p.url()} (mobile)`);
    await p.goBack({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
  }

  // MOBILE GOLF
  await measureLoad(p, `${BASE}/golf`, "/golf (mobile)");
  await shot(p, "golf-mobile");
  await checkOverflow(p, "/golf (mobile)");
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(500);
  await shot(p, "golf-mobile-scrolled");

  // MOBILE FAIRBET
  await measureLoad(p, `${BASE}/fairbet`, "/fairbet (mobile)");
  await shot(p, "fairbet-mobile");
  await checkOverflow(p, "/fairbet (mobile)");
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(500);
  await shot(p, "fairbet-mobile-scrolled");

  // MOBILE LOGIN
  await measureLoad(p, `${BASE}/login`, "/login (mobile)");
  await shot(p, "login-mobile");
  await checkOverflow(p, "/login (mobile)");

  // Empty submit on mobile
  const mSubmit = p.locator('button[type="submit"]').first();
  if (await mSubmit.count() > 0) {
    await mSubmit.tap({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(1000);
    await shot(p, "login-mobile-empty-submit");
  }

  // Invalid email on mobile
  const mEmail = p.locator('input[type="email"], input[name="email"]').first();
  if (await mEmail.count() > 0) {
    await mEmail.tap({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(300);
    await shot(p, "login-mobile-focused");
    await mEmail.fill("bad");
    await p.locator('input[type="password"]').first().fill("x").catch(() => {});
    await mSubmit.tap({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(1000);
    await shot(p, "login-mobile-invalid");
  }

  // MOBILE SETTINGS
  await measureLoad(p, `${BASE}/settings`, "/settings (mobile)");
  await shot(p, "settings-mobile");
  await checkOverflow(p, "/settings (mobile)");

  const mToggles = await p.locator('[role="switch"]').all();
  if (mToggles.length > 0) {
    await mToggles[0].tap({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(500);
    await shot(p, "settings-mobile-toggled");
  }

  // MOBILE PROFILE
  await measureLoad(p, `${BASE}/profile`, "/profile (mobile)");
  await shot(p, "profile-mobile");

  // MOBILE ANALYTICS
  await measureLoad(p, `${BASE}/analytics`, "/analytics (mobile)");
  await shot(p, "analytics-mobile");
  await checkOverflow(p, "/analytics (mobile)");

  // MOBILE HISTORY
  await measureLoad(p, `${BASE}/history`, "/history (mobile)");
  await shot(p, "history-mobile");
  await checkOverflow(p, "/history (mobile)");

  // MOBILE DARK
  await p.emulateMedia({ colorScheme: "dark" });
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(4000); // wait for API response + error state render
  await shot(p, "home-mobile-dark");
  await p.goto(`${BASE}/fairbet`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(4000);
  await shot(p, "fairbet-mobile-dark");
  await p.goto(`${BASE}/golf`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(4000);
  await shot(p, "golf-mobile-dark");
  await p.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(2000);
  await shot(p, "settings-mobile-dark");

  // MOBILE 404
  await p.emulateMedia({ colorScheme: "light" });
  await p.goto(`${BASE}/nonexistent-page-xyz`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await shot(p, "404-mobile");

  // MOBILE NAV FLOW
  console.log("  Mobile nav flow test...");
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
  const navItems = await p.locator('nav a').all();
  console.log(`  Nav links: ${navItems.length}`);
  for (let i = 0; i < Math.min(navItems.length, 5); i++) {
    try {
      await navItems[i].tap({ timeout: 3000 });
      await p.waitForTimeout(800);
    } catch {}
  }
  await shot(p, "mobile-nav-flow-end");

  // RAPID NAVIGATION
  console.log("  Rapid navigation test...");
  for (const route of ["/", "/golf", "/fairbet", "/settings", "/", "/golf"]) {
    await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 10000 });
    await p.waitForTimeout(200);
  }
  await shot(p, "rapid-nav-end");

  // TERMS / PRIVACY
  await p.goto(`${BASE}/terms`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await shot(p, "terms-mobile");
  await p.goto(`${BASE}/privacy`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await shot(p, "privacy-mobile");

  // FORGOT PASSWORD
  await p.goto(`${BASE}/forgot-password`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await shot(p, "forgot-password-mobile");

  await mCtx.close();
  await browser.close();

  // ========== SUMMARY ==========
  console.log("\n=== SUMMARY ===\n");
  console.log(`Observations: ${observations.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  observations.forEach((o, i) => console.log(`  ${i + 1}. [${o.type}/${o.severity}] ${o.page}: ${o.description}`));
  const uniqueErrors = [...new Set(consoleErrors.map(e => `${e.page}: ${e.message}`))];
  if (uniqueErrors.length > 0) {
    console.log("\nConsole Errors (deduplicated):");
    uniqueErrors.forEach(e => console.log(`  - ${e}`));
  }

  fs.writeFileSync(
    path.resolve(__dirname, "../../docs/audit-results/explore-qa-results.json"),
    JSON.stringify({ observations, consoleErrors: uniqueErrors, timestamp: new Date().toISOString() }, null, 2)
  );
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
