import { chromium } from "playwright";
import path from "path";

const BASE = "http://localhost:3001";
const SCREENSHOT_DIR = path.resolve(__dirname, "../docs/audit-results/screenshots");

async function main() {
  const browser = await chromium.launch();

  // Desktop viewport
  const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const desktop = await desktopCtx.newPage();

  // Mobile viewport
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await mobileCtx.newPage();

  // Home page - desktop (check friendly error + retry button)
  await desktop.goto(BASE, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(2000);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-home-desktop.png"), fullPage: true });

  // Home page - mobile (check touch targets)
  await mobile.goto(BASE, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(2000);
  await mobile.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-home-mobile.png"), fullPage: true });

  // Golf page - desktop (check retry button)
  await desktop.goto(`${BASE}/golf`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(2000);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-golf-desktop.png"), fullPage: true });

  // FairBet page - desktop (check duplicate All pills fixed)
  await desktop.goto(`${BASE}/fairbet`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(2000);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-fairbet-desktop.png"), fullPage: true });

  // FairBet page - mobile
  await mobile.goto(`${BASE}/fairbet`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(2000);
  await mobile.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-fairbet-mobile.png"), fullPage: true });

  // History page - desktop (check improved message)
  await desktop.goto(`${BASE}/history`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(2000);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-history-desktop.png"), fullPage: true });

  // Profile -> Login redirect (check reason message)
  await desktop.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(2000);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, "explore-fixed-profile-redirect.png"), fullPage: true });

  await browser.close();
  console.log("Verification screenshots saved.");
}

main().catch(console.error);
