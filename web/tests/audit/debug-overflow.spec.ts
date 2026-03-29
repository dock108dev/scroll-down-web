import { test } from "@playwright/test";

test("debug overflow elements", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");

  // Detailed overflow detection
  const overflowingElements = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const overflowing: any[] = [];
    
    document.querySelectorAll("*").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 5 || rect.left < -5) {
        overflowing.push({
          tag: el.tagName,
          class: el.className,
          text: (el.textContent || "").substring(0, 50),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    });
    
    return { docWidth, total: overflowing.length, items: overflowing };
  });

  console.log("\n=== OVERFLOW DEBUG ===");
  console.log("Total overflowing:", overflowingElements.total);
  console.log("Doc width:", overflowingElements.docWidth);
  overflowingElements.items.slice(0, 30).forEach((el, i) => {
    console.log(`${i + 1}. <${el.tag} class="${el.class}">: left=${el.left}, right=${el.right}, width=${el.width}`);
  });
});
