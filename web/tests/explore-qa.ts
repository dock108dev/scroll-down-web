/**
 * Exploratory QA script — browses the live app like a real sports fan.
 * Run: cd web && npx tsx tests/explore-qa.ts
 */
import { chromium, Page, Browser, ConsoleMessage } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3001";
const SCREENSHOT_DIR = path.resolve(__dirname, "..", "..", "docs", "audit-results", "screenshots");

// Ensure screenshot dir exists
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface Finding {
  type: "bug" | "ux" | "feature" | "data" | "visual" | "perf";
  severity: "low" | "medium" | "high" | "critical";
  page: string;
  title: string;
  detail: string;
  screenshot?: string;
}

const findings: Finding[] = [];
const consoleErrors: { page: string; msg: string }[] = [];

function addFinding(f: Finding) {
  findings.push(f);
  console.log(`[${f.type.toUpperCase()}] ${f.severity}: ${f.title}`);
}

async function screenshot(page: Page, name: string): Promise<string> {
  const file = path.join(SCREENSHOT_DIR, `explore-qa-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${name}`);
  return `explore-qa-${name}.png`;
}

function collectConsoleErrors(page: Page, pageName: string) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      consoleErrors.push({ page: pageName, msg: msg.text() });
    }
  });
}

// ─── Desktop session ───────────────────────────────────────────────────────
async function desktopSession(browser: Browser) {
  console.log("\n═══ DESKTOP SESSION (1280×720) ═══\n");
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  collectConsoleErrors(page, "desktop");

  // ── HOME PAGE ──
  console.log("→ Home page");
  const homeStart = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  const homeLoad = Date.now() - homeStart;
  await page.waitForTimeout(2000);
  await screenshot(page, "home-desktop-light");

  // Check for content
  const gameCards = await page.locator('[data-testid="game-card"], .game-card, [class*="GameCard"], [class*="game-card"], a[href^="/game/"]').count();
  console.log(`  Game cards found: ${gameCards}`);
  if (gameCards === 0) {
    // Check for empty states or loading indicators
    const loading = await page.locator('[class*="loading"], [class*="spinner"], [class*="skeleton"]').count();
    const bodyText = await page.locator("body").innerText();
    if (bodyText.includes("No games") || bodyText.includes("no games")) {
      console.log("  Empty state shown — no games available");
    } else if (loading > 0) {
      addFinding({
        type: "bug",
        severity: "high",
        page: "/",
        title: "Home page stuck in loading state",
        detail: `After ${homeLoad}ms, the home page still shows loading indicators with no game content.`,
      });
    }
  }

  if (homeLoad > 5000) {
    addFinding({
      type: "perf",
      severity: "medium",
      page: "/",
      title: `Home page slow load: ${homeLoad}ms`,
      detail: `Home page took ${homeLoad}ms to reach networkidle.`,
    });
  }

  // Check for horizontal overflow
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (hasOverflow) {
    addFinding({
      type: "visual",
      severity: "medium",
      page: "/",
      title: "Home page has horizontal overflow on desktop",
      detail: "Content extends beyond viewport width.",
      screenshot: await screenshot(page, "home-desktop-overflow"),
    });
  }

  // Try scrolling and interacting with game list
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await screenshot(page, "home-desktop-scrolled");

  // Check sport filter tabs if they exist
  const sportTabs = await page.locator('button[role="tab"], [class*="SportTab"], [class*="sport-tab"], [class*="TabButton"]').all();
  if (sportTabs.length > 0) {
    console.log(`  Sport filter tabs found: ${sportTabs.length}`);
    for (let i = 0; i < Math.min(sportTabs.length, 3); i++) {
      try {
        await sportTabs[i].click();
        await page.waitForTimeout(800);
      } catch {}
    }
    await screenshot(page, "home-desktop-after-tab-click");
  }

  // ── GAME DETAIL PAGE ──
  console.log("→ Game detail page");
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Find any clickable game link
  const gameLinks = await page.locator('a[href^="/game/"]').all();
  console.log(`  Game links found: ${gameLinks.length}`);
  if (gameLinks.length > 0) {
    const href = await gameLinks[0].getAttribute("href");
    console.log(`  Clicking first game: ${href}`);
    await gameLinks[0].click();
    await page.waitForTimeout(2000);
    await screenshot(page, "game-detail-desktop");

    // Check for score display
    const scoreText = await page.locator('[class*="score"], [class*="Score"]').count();
    console.log(`  Score elements: ${scoreText}`);

    // Try to find and click any interactive elements (expand, reveal score, etc.)
    const expandButtons = await page.locator('button[class*="expand"], button[class*="Expand"], [class*="accordion"], details summary').all();
    for (const btn of expandButtons.slice(0, 3)) {
      try { await btn.click(); await page.waitForTimeout(300); } catch {}
    }

    // Check back navigation
    await page.goBack();
    await page.waitForTimeout(1000);
  } else {
    addFinding({
      type: "ux",
      severity: "medium",
      page: "/",
      title: "No game links found on home page",
      detail: "Home page doesn't display any clickable game cards/links. Could be an API issue or empty state.",
    });
  }

  // ── GOLF PAGE ──
  console.log("→ Golf page");
  await page.goto(`${BASE}/golf`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, "golf-desktop");

  const golfContent = await page.locator("body").innerText();
  if (golfContent.length < 100) {
    addFinding({
      type: "bug",
      severity: "medium",
      page: "/golf",
      title: "Golf page appears empty",
      detail: "Golf page body has very little text content.",
    });
  }

  // Check for golf event links
  const golfEventLinks = await page.locator('a[href*="/golf/"]').all();
  console.log(`  Golf event links: ${golfEventLinks.length}`);
  if (golfEventLinks.length > 0) {
    await golfEventLinks[0].click();
    await page.waitForTimeout(2000);
    await screenshot(page, "golf-event-desktop");

    // Check for leaderboard table
    const tables = await page.locator("table, [class*='leaderboard'], [class*='Leaderboard']").count();
    console.log(`  Leaderboard elements: ${tables}`);
    await page.goBack();
    await page.waitForTimeout(500);
  }

  // ── FAIRBET PAGE ──
  console.log("→ FairBet page");
  await page.goto(`${BASE}/fairbet`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, "fairbet-desktop");

  // Check for tabs on fairbet
  const fairbetTabs = await page.locator('button[role="tab"], [class*="tab"], [role="tablist"] button').all();
  console.log(`  FairBet tabs: ${fairbetTabs.length}`);
  if (fairbetTabs.length > 1) {
    await fairbetTabs[1].click();
    await page.waitForTimeout(1000);
    await screenshot(page, "fairbet-tab2-desktop");
  }

  // ── ANALYTICS PAGE ──
  console.log("→ Analytics page");
  await page.goto(`${BASE}/analytics`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, "analytics-desktop");

  // ── HISTORY PAGE ──
  console.log("→ History page");
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, "history-desktop");

  // ── LOGIN PAGE ──
  console.log("→ Login page");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await screenshot(page, "login-desktop");

  // Test form validation
  const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")').first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, "login-validation-desktop");

    // Try invalid email
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill("notanemail");
      const pwInput = page.locator('input[type="password"]').first();
      if (await pwInput.isVisible().catch(() => false)) {
        await pwInput.fill("x");
      }
      await submitBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, "login-invalid-desktop");
    }
  }

  // ── FORGOT PASSWORD ──
  console.log("→ Forgot password page");
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await screenshot(page, "forgot-pw-desktop");

  // ── PROFILE PAGE ──
  console.log("→ Profile page");
  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await screenshot(page, "profile-desktop");

  // ── SETTINGS ──
  console.log("→ Settings");
  // Settings may be a drawer/modal, check for settings button in nav
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const settingsBtn = page.locator('button[aria-label*="settings" i], button[aria-label*="Settings"], a[href*="settings"], [data-testid="settings"]').first();
  if (await settingsBtn.isVisible().catch(() => false)) {
    await settingsBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, "settings-desktop");

    // Toggle dark mode if available
    const darkToggle = page.locator('button:has-text("Dark"), [class*="theme"], [class*="dark-mode"], input[type="checkbox"]').first();
    if (await darkToggle.isVisible().catch(() => false)) {
      await darkToggle.click();
      await page.waitForTimeout(500);
      await screenshot(page, "settings-dark-toggle-desktop");
    }
  }

  // ── DARK MODE CHECKS ──
  console.log("→ Dark mode checks");
  const darkContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: "dark",
  });
  const darkPage = await darkContext.newPage();

  await darkPage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await darkPage.waitForTimeout(2000);
  await screenshot(darkPage, "home-dark-desktop");

  await darkPage.goto(`${BASE}/golf`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await darkPage.waitForTimeout(1500);
  await screenshot(darkPage, "golf-dark-desktop");

  await darkPage.goto(`${BASE}/fairbet`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await darkPage.waitForTimeout(1500);
  await screenshot(darkPage, "fairbet-dark-desktop");

  await darkPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await darkPage.waitForTimeout(1000);
  await screenshot(darkPage, "login-dark-desktop");

  await darkContext.close();

  // ── PRIVACY & TERMS ──
  console.log("→ Privacy & Terms");
  await page.goto(`${BASE}/privacy`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await screenshot(page, "privacy-desktop");

  await page.goto(`${BASE}/terms`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await screenshot(page, "terms-desktop");

  // ── 404 PAGE ──
  console.log("→ 404 page");
  await page.goto(`${BASE}/this-page-does-not-exist`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await screenshot(page, "404-desktop");

  // ── RAPID NAVIGATION ──
  console.log("→ Rapid navigation test");
  const routes = ["/", "/golf", "/fairbet", "/analytics", "/history", "/"];
  for (const route of routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);
  await screenshot(page, "after-rapid-nav-desktop");

  await context.close();
}

// ─── Mobile session ────────────────────────────────────────────────────────
async function mobileSession(browser: Browser) {
  console.log("\n═══ MOBILE SESSION (390×844) ═══\n");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  collectConsoleErrors(page, "mobile");

  // ── HOME ──
  console.log("→ Home (mobile)");
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, "home-mobile");

  // Check overflow
  const mobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (mobileOverflow) {
    addFinding({
      type: "visual",
      severity: "high",
      page: "/",
      title: "Home page has horizontal overflow on mobile",
      detail: "Content extends beyond 390px viewport width, causing unwanted horizontal scroll.",
      screenshot: await screenshot(page, "home-mobile-overflow"),
    });
  }

  // Scroll and check bottom nav
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await screenshot(page, "home-mobile-scrolled");

  // Check bottom nav visibility
  const bottomNav = await page.locator('nav[class*="bottom" i], [class*="BottomTab"], [class*="bottom-tab"], nav:below(main)').count();
  console.log(`  Bottom nav elements: ${bottomNav}`);

  // Try clicking through bottom nav tabs
  const navButtons = await page.locator('nav a, nav button').all();
  console.log(`  Nav buttons: ${navButtons.length}`);
  for (let i = 0; i < Math.min(navButtons.length, 5); i++) {
    try {
      const label = await navButtons[i].innerText().catch(() => "");
      console.log(`  Tapping nav: "${label}"`);
      await navButtons[i].click();
      await page.waitForTimeout(800);
    } catch {}
  }
  await screenshot(page, "mobile-after-nav-taps");

  // ── GAME DETAIL (mobile) ──
  console.log("→ Game detail (mobile)");
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const mobileGameLinks = await page.locator('a[href^="/game/"]').all();
  if (mobileGameLinks.length > 0) {
    await mobileGameLinks[0].click();
    await page.waitForTimeout(2000);
    await screenshot(page, "game-detail-mobile");

    // Check mobile overflow on game detail
    const gameOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (gameOverflow) {
      addFinding({
        type: "visual",
        severity: "high",
        page: "/game/[id]",
        title: "Game detail page overflows on mobile",
        detail: "Game detail content exceeds 390px viewport.",
        screenshot: await screenshot(page, "game-detail-mobile-overflow"),
      });
    }
    await page.goBack();
    await page.waitForTimeout(500);
  }

  // ── GOLF (mobile) ──
  console.log("→ Golf (mobile)");
  await page.goto(`${BASE}/golf`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, "golf-mobile");

  const golfMobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (golfMobileOverflow) {
    addFinding({
      type: "visual",
      severity: "high",
      page: "/golf",
      title: "Golf page overflows on mobile",
      detail: "Golf content exceeds 390px viewport.",
      screenshot: await screenshot(page, "golf-mobile-overflow"),
    });
  }

  // Check golf event on mobile
  const mobileGolfLinks = await page.locator('a[href*="/golf/"]').all();
  if (mobileGolfLinks.length > 0) {
    await mobileGolfLinks[0].click();
    await page.waitForTimeout(2000);
    await screenshot(page, "golf-event-mobile");

    const golfEventOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (golfEventOverflow) {
      addFinding({
        type: "visual",
        severity: "high",
        page: "/golf/[eventId]",
        title: "Golf leaderboard overflows on mobile",
        detail: "Leaderboard table extends beyond mobile viewport.",
        screenshot: await screenshot(page, "golf-event-mobile-overflow"),
      });
    }
    await page.goBack();
    await page.waitForTimeout(500);
  }

  // ── FAIRBET (mobile) ──
  console.log("→ FairBet (mobile)");
  await page.goto(`${BASE}/fairbet`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, "fairbet-mobile");

  const fairbetMobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (fairbetMobileOverflow) {
    addFinding({
      type: "visual",
      severity: "medium",
      page: "/fairbet",
      title: "FairBet page overflows on mobile",
      detail: "FairBet content exceeds 390px viewport.",
      screenshot: await screenshot(page, "fairbet-mobile-overflow"),
    });
  }

  // Scroll fairbet
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await screenshot(page, "fairbet-mobile-scrolled");

  // ── ANALYTICS (mobile) ──
  console.log("→ Analytics (mobile)");
  await page.goto(`${BASE}/analytics`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, "analytics-mobile");

  // ── HISTORY (mobile) ──
  console.log("→ History (mobile)");
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await screenshot(page, "history-mobile");

  // ── LOGIN (mobile) ──
  console.log("→ Login (mobile)");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await screenshot(page, "login-mobile");

  // Test touch targets — check if buttons/links are big enough
  const allButtons = await page.locator("button, a").all();
  let smallTargets = 0;
  for (const btn of allButtons.slice(0, 20)) {
    try {
      const box = await btn.boundingBox();
      if (box && (box.width < 44 || box.height < 44) && box.width > 0) {
        smallTargets++;
      }
    } catch {}
  }
  if (smallTargets > 5) {
    addFinding({
      type: "ux",
      severity: "medium",
      page: "/login",
      title: `${smallTargets} touch targets below 44px minimum on login (mobile)`,
      detail: "Apple HIG recommends minimum 44×44px touch targets. Multiple interactive elements are smaller.",
    });
  }

  // ── PROFILE (mobile) ──
  console.log("→ Profile (mobile)");
  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await screenshot(page, "profile-mobile");

  // ── DARK MODE (mobile) ──
  console.log("→ Dark mode (mobile)");
  const darkMobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
    isMobile: true,
    hasTouch: true,
  });
  const darkMobilePage = await darkMobileCtx.newPage();

  await darkMobilePage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await darkMobilePage.waitForTimeout(2000);
  await screenshot(darkMobilePage, "home-dark-mobile");

  await darkMobilePage.goto(`${BASE}/fairbet`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await darkMobilePage.waitForTimeout(1500);
  await screenshot(darkMobilePage, "fairbet-dark-mobile");

  await darkMobilePage.goto(`${BASE}/golf`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await darkMobilePage.waitForTimeout(1500);
  await screenshot(darkMobilePage, "golf-dark-mobile");

  await darkMobileCtx.close();

  // ── SETTINGS (mobile) ──
  console.log("→ Settings (mobile)");
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const mobileSettingsBtn = page.locator('button[aria-label*="settings" i], button[aria-label*="Settings"], [data-testid="settings"]').first();
  if (await mobileSettingsBtn.isVisible().catch(() => false)) {
    await mobileSettingsBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, "settings-mobile");

    // Try toggling something
    const toggles = await page.locator('input[type="checkbox"], [role="switch"], button[class*="toggle" i]').all();
    console.log(`  Setting toggles: ${toggles.length}`);
    if (toggles.length > 0) {
      await toggles[0].click();
      await page.waitForTimeout(500);
      await screenshot(page, "settings-toggled-mobile");
    }
  }

  await context.close();
}

// ─── API spot checks ───────────────────────────────────────────────────────
async function apiChecks() {
  console.log("\n═══ API SPOT CHECKS ═══\n");
  const endpoints = [
    "/api/health",
    "/api/games",
    "/api/games/live",
    "/api/golf/events",
    "/api/fairbet/odds",
  ];

  for (const ep of endpoints) {
    try {
      const start = Date.now();
      const res = await fetch(`${BASE}${ep}`);
      const elapsed = Date.now() - start;
      const contentType = res.headers.get("content-type") || "";
      let bodyPreview = "";
      try {
        const text = await res.text();
        bodyPreview = text.substring(0, 200);
      } catch {}

      console.log(`  ${ep}: ${res.status} (${elapsed}ms) ${contentType}`);

      if (res.status >= 500) {
        addFinding({
          type: "bug",
          severity: "high",
          page: ep,
          title: `API ${ep} returns ${res.status}`,
          detail: `Server error: ${bodyPreview}`,
        });
      } else if (res.status === 404) {
        console.log(`    (not found — may not be a real endpoint)`);
      } else if (elapsed > 5000) {
        addFinding({
          type: "perf",
          severity: "medium",
          page: ep,
          title: `API ${ep} slow: ${elapsed}ms`,
          detail: `Response took ${elapsed}ms which exceeds 5s threshold.`,
        });
      }
    } catch (err: unknown) {
      console.log(`  ${ep}: FAILED - ${(err as Error).message}`);
      addFinding({
        type: "bug",
        severity: "high",
        page: ep,
        title: `API ${ep} request failed`,
        detail: `Error: ${(err as Error).message}`,
      });
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("Starting exploratory QA session...\n");

  const browser = await chromium.launch({ headless: true });

  try {
    await desktopSession(browser);
    await mobileSession(browser);
    await apiChecks();
  } finally {
    await browser.close();
  }

  // ── Report ──
  console.log("\n═══ SUMMARY ═══\n");
  console.log(`Findings: ${findings.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);

  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.type}: ${f.title}`);
  }

  if (consoleErrors.length > 0) {
    console.log("\nConsole errors:");
    const uniqueErrors = [...new Set(consoleErrors.map(e => `${e.page}: ${e.msg}`))];
    for (const err of uniqueErrors.slice(0, 20)) {
      console.log(`  ${err}`);
    }

    if (uniqueErrors.length > 3) {
      addFinding({
        type: "bug",
        severity: "medium",
        page: "multiple",
        title: `${uniqueErrors.length} unique console errors found`,
        detail: `Errors:\n${uniqueErrors.slice(0, 10).join("\n")}`,
      });
    }
  }

  // Write findings JSON for report generation
  const outputPath = path.join(SCREENSHOT_DIR, "../explore-findings.json");
  fs.writeFileSync(outputPath, JSON.stringify({ findings, consoleErrors, timestamp: new Date().toISOString() }, null, 2));
  console.log(`\nFindings saved to ${outputPath}`);
}

main().catch(console.error);
