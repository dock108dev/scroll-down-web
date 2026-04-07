/**
 * Exploratory QA Script — 2026-04-06
 * Browses the live app like a real sports fan, takes screenshots, collects observations.
 * Run: cd web && npx tsx tests/explore-qa.ts
 */
import { chromium, type Page, type BrowserContext, type ConsoleMessage } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3001";
const SCREENSHOTS = path.resolve(__dirname, "../../docs/audit-results/screenshots");
const RESULTS_DIR = path.resolve(__dirname, "../../docs/audit-results");
const DESKTOP = { width: 1280, height: 720 };
const MOBILE = { width: 390, height: 844 };

interface Finding {
  type: "bug" | "ux" | "visual" | "data" | "perf";
  severity: "low" | "medium" | "high" | "critical";
  page: string;
  description: string;
  screenshot?: string;
}

const findings: Finding[] = [];
const consoleErrors: { page: string; message: string }[] = [];

async function shot(page: Page, name: string): Promise<string> {
  const file = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function collectConsole(page: Page, label: string) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      consoleErrors.push({ page: label, message: msg.text() });
    }
  });
}

async function checkOverflow(page: Page, label: string): Promise<string[]> {
  const overflows = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const html = el as HTMLElement;
      if (html.scrollWidth > html.clientWidth + 2 && html.clientWidth > 0) {
        const tag = html.tagName.toLowerCase();
        const cls = html.className?.toString().slice(0, 60) || "";
        results.push(`${tag}.${cls} (scrollW=${html.scrollWidth}, clientW=${html.clientWidth})`);
      }
    });
    return results;
  });
  if (overflows.length > 0) {
    findings.push({
      type: "visual",
      severity: "medium",
      page: label,
      description: `Horizontal overflow: ${overflows.slice(0, 3).join("; ")}`,
    });
  }
  return overflows;
}

async function load(page: Page, url: string): Promise<number> {
  const start = Date.now();
  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  return Date.now() - start;
}

async function exploreDesktop(ctx: BrowserContext) {
  const page = await ctx.newPage();
  collectConsole(page, "desktop");

  // HOME
  console.log("Desktop: Home...");
  const homeMs = await load(page, BASE);
  await shot(page, "explore-qa7-home-desktop");
  if (homeMs > 3000) findings.push({ type: "perf", severity: "medium", page: "/", description: `Home load ${homeMs}ms` });

  const gameLinks = await page.locator('a[href^="/game/"]').all();
  console.log(`  Game links: ${gameLinks.length}`);

  // Sport tabs
  const allBtns = await page.locator("button").allTextContents();
  const sportTabs = allBtns.filter(t => /^(All|NFL|NBA|MLB|NHL|NCAAF|NCAAB|Soccer)$/i.test(t.trim()));
  console.log(`  Sport tabs: ${sportTabs.join(", ") || "none"}`);
  if (sportTabs.length > 1) {
    await page.locator(`button:has-text("${sportTabs[1]}")`).first().click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, "explore-qa7-home-desktop-filtered");
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "explore-qa7-home-desktop-scrolled");
  await checkOverflow(page, "/ (desktop)");

  // GAME DETAIL
  if (gameLinks.length > 0) {
    console.log("Desktop: Game detail...");
    await gameLinks[0].click();
    await page.waitForTimeout(2000);
    await shot(page, "explore-qa7-game-detail-desktop");
    await checkOverflow(page, page.url());

    const revealBtns = await page.locator('button:has-text("reveal"), button:has-text("show"), [data-testid*="reveal"]').count();
    console.log(`  Reveal buttons: ${revealBtns}`);
    if (revealBtns > 0) {
      await page.locator('button:has-text("reveal"), button:has-text("show")').first().click().catch(() => {});
      await page.waitForTimeout(500);
      await shot(page, "explore-qa7-game-detail-revealed");
    }
    await page.goBack();
    await page.waitForTimeout(500);
  } else {
    findings.push({ type: "data", severity: "high", page: "/", description: "No game links found on home page" });
  }

  // GOLF
  console.log("Desktop: Golf...");
  await load(page, `${BASE}/golf`);
  await page.waitForTimeout(500);
  await shot(page, "explore-qa7-golf-desktop");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "explore-qa7-golf-desktop-scrolled");
  await checkOverflow(page, "/golf (desktop)");

  // FAIRBET
  console.log("Desktop: FairBet...");
  await load(page, `${BASE}/fairbet`);
  await page.waitForTimeout(500);
  await shot(page, "explore-qa7-fairbet-desktop");
  const fbTabs = await page.locator('[role="tab"]').allTextContents();
  console.log(`  FairBet tabs: ${fbTabs.join(", ") || "none"}`);
  if (fbTabs.length > 1) {
    await page.locator('[role="tab"]').nth(1).click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, "explore-qa7-fairbet-desktop-tab2");
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "explore-qa7-fairbet-desktop-scrolled");
  await checkOverflow(page, "/fairbet (desktop)");

  // LOGIN
  console.log("Desktop: Login...");
  await load(page, `${BASE}/login`);
  await shot(page, "explore-qa7-login-desktop");

  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count() > 0) {
    await submit.click();
    await page.waitForTimeout(500);
    await shot(page, "explore-qa7-login-desktop-empty-submit");
  }
  const email = page.locator('input[type="email"], input[name="email"]').first();
  if (await email.count() > 0) {
    await email.fill("bademail");
    await page.locator('input[type="password"]').first().fill("x").catch(() => {});
    await submit.click().catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, "explore-qa7-login-desktop-invalid");
  }
  await checkOverflow(page, "/login (desktop)");

  // SETTINGS
  console.log("Desktop: Settings...");
  await load(page, `${BASE}/settings`);
  await shot(page, "explore-qa7-settings-desktop");
  const toggles = await page.locator('button[role="switch"]').all();
  console.log(`  Toggles: ${toggles.length}`);
  if (toggles.length > 0) {
    await toggles[0].click().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, "explore-qa7-settings-desktop-toggled");
  }
  await checkOverflow(page, "/settings (desktop)");

  // PROFILE
  console.log("Desktop: Profile...");
  await load(page, `${BASE}/profile`);
  await shot(page, "explore-qa7-profile-desktop");
  await checkOverflow(page, "/profile (desktop)");

  // ANALYTICS
  console.log("Desktop: Analytics...");
  await load(page, `${BASE}/analytics`);
  await page.waitForTimeout(500);
  await shot(page, "explore-qa7-analytics-desktop");
  await checkOverflow(page, "/analytics (desktop)");

  // HISTORY
  console.log("Desktop: History...");
  await load(page, `${BASE}/history`);
  await shot(page, "explore-qa7-history-desktop");
  await checkOverflow(page, "/history (desktop)");

  // FORGOT PASSWORD
  console.log("Desktop: Forgot password...");
  await load(page, `${BASE}/forgot-password`);
  await shot(page, "explore-qa7-forgot-pw-desktop");

  // STATIC PAGES
  for (const r of ["/privacy", "/terms", "/contact"]) {
    console.log(`Desktop: ${r}...`);
    await load(page, `${BASE}${r}`);
    await shot(page, `explore-qa7-${r.slice(1)}-desktop`);
  }

  // 404
  console.log("Desktop: 404...");
  await load(page, `${BASE}/nonexistent-xyz`);
  await shot(page, "explore-qa7-404-desktop");

  // DARK MODE
  console.log("Desktop: Dark mode...");
  await load(page, `${BASE}/settings`);
  // Find and click dark mode toggle
  const switches = await page.locator('button[role="switch"]').all();
  for (const s of switches) {
    const nearby = await s.evaluate(el => el.closest("div, label")?.textContent || "");
    if (/dark|theme|mode|appearance/i.test(nearby)) {
      await s.click();
      await page.waitForTimeout(300);
      break;
    }
  }
  for (const r of ["/", "/fairbet", "/golf", "/settings"]) {
    await load(page, `${BASE}${r}`);
    await page.waitForTimeout(300);
    await shot(page, `explore-qa7-dark-${r === "/" ? "home" : r.slice(1)}-desktop`);
  }

  // RAPID NAV
  console.log("Desktop: Rapid navigation...");
  for (const r of ["/", "/golf", "/fairbet", "/settings", "/", "/analytics"]) {
    page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1000);
  await shot(page, "explore-qa7-rapid-nav-end-desktop");

  await page.close();
}

async function exploreMobile(ctx: BrowserContext) {
  const page = await ctx.newPage();
  collectConsole(page, "mobile");

  // HOME
  console.log("Mobile: Home...");
  await load(page, BASE);
  await page.waitForTimeout(500);
  await shot(page, "explore-qa7-home-mobile");
  await checkOverflow(page, "/ (mobile)");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "explore-qa7-home-mobile-scrolled");

  // GOLF
  console.log("Mobile: Golf...");
  await load(page, `${BASE}/golf`);
  await page.waitForTimeout(500);
  await shot(page, "explore-qa7-golf-mobile");
  await checkOverflow(page, "/golf (mobile)");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "explore-qa7-golf-mobile-scrolled");

  // FAIRBET
  console.log("Mobile: FairBet...");
  await load(page, `${BASE}/fairbet`);
  await page.waitForTimeout(500);
  await shot(page, "explore-qa7-fairbet-mobile");
  await checkOverflow(page, "/fairbet (mobile)");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "explore-qa7-fairbet-mobile-scrolled");

  // LOGIN
  console.log("Mobile: Login...");
  await load(page, `${BASE}/login`);
  await shot(page, "explore-qa7-login-mobile");
  const email = page.locator('input[type="email"], input[name="email"]').first();
  if (await email.count() > 0) {
    await email.tap().catch(() => email.click());
    await page.waitForTimeout(500);
    await shot(page, "explore-qa7-login-mobile-focused");
  }
  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count() > 0) {
    await email.fill("").catch(() => {});
    await submit.tap().catch(() => submit.click());
    await page.waitForTimeout(500);
    await shot(page, "explore-qa7-login-mobile-empty-submit");
  }
  await checkOverflow(page, "/login (mobile)");

  // SETTINGS
  console.log("Mobile: Settings...");
  await load(page, `${BASE}/settings`);
  await shot(page, "explore-qa7-settings-mobile");
  const toggle = page.locator('button[role="switch"]').first();
  if (await toggle.count() > 0) {
    await toggle.tap().catch(() => toggle.click());
    await page.waitForTimeout(300);
    await shot(page, "explore-qa7-settings-mobile-dark-toggled");
  }
  await checkOverflow(page, "/settings (mobile)");

  // DARK MODE MOBILE
  for (const r of ["/", "/fairbet"]) {
    await load(page, `${BASE}${r}`);
    await page.waitForTimeout(300);
    await shot(page, `explore-qa7-dark-${r === "/" ? "home" : r.slice(1)}-mobile`);
  }

  // PROFILE
  console.log("Mobile: Profile...");
  await load(page, `${BASE}/profile`);
  await shot(page, "explore-qa7-profile-mobile");

  // ANALYTICS
  console.log("Mobile: Analytics...");
  await load(page, `${BASE}/analytics`);
  await page.waitForTimeout(500);
  await shot(page, "explore-qa7-analytics-mobile");
  await checkOverflow(page, "/analytics (mobile)");

  // HISTORY
  console.log("Mobile: History...");
  await load(page, `${BASE}/history`);
  await shot(page, "explore-qa7-history-mobile");

  // FORGOT PW
  console.log("Mobile: Forgot password...");
  await load(page, `${BASE}/forgot-password`);
  await shot(page, "explore-qa7-forgot-pw-mobile");

  // STATIC
  for (const r of ["/privacy", "/terms", "/contact"]) {
    console.log(`Mobile: ${r}...`);
    await load(page, `${BASE}${r}`);
    await shot(page, `explore-qa7-${r.slice(1)}-mobile`);
    await checkOverflow(page, `${r} (mobile)`);
  }

  // 404
  console.log("Mobile: 404...");
  await load(page, `${BASE}/nonexistent-xyz`);
  await shot(page, "explore-qa7-404-mobile");

  // NAV FLOW
  console.log("Mobile: Nav flow...");
  const navLinks = await page.locator("nav a").all();
  console.log(`  Nav links: ${navLinks.length}`);
  for (let i = 0; i < Math.min(navLinks.length, 5); i++) {
    await navLinks[i].tap().catch(() => navLinks[i].click().catch(() => {}));
    await page.waitForTimeout(500);
  }
  await shot(page, "explore-qa7-nav-flow-end-mobile");

  await page.close();
}

async function main() {
  console.log("=== Exploratory QA — 2026-04-06 ===\n");
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  console.log("\n--- Desktop (1280x720) ---\n");
  const dCtx = await browser.newContext({ viewport: DESKTOP });
  await exploreDesktop(dCtx);
  await dCtx.close();

  console.log("\n--- Mobile (390x844) ---\n");
  const mCtx = await browser.newContext({ viewport: MOBILE, isMobile: true, hasTouch: true });
  await exploreMobile(mCtx);
  await mCtx.close();

  await browser.close();

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Findings: ${findings.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  console.log("\n--- Findings ---");
  for (const f of findings) console.log(`[${f.type}/${f.severity}] ${f.page}: ${f.description}`);
  console.log("\n--- Console Errors ---");
  const uniqueErrors = [...new Set(consoleErrors.map(e => `[${e.page}] ${e.message.slice(0, 200)}`))];
  for (const e of uniqueErrors) console.log(e);

  // Save results
  fs.writeFileSync(
    path.join(RESULTS_DIR, "explore-qa7-results.json"),
    JSON.stringify({ findings, consoleErrors: uniqueErrors, timestamp: new Date().toISOString() }, null, 2)
  );
  console.log("\nResults saved.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
