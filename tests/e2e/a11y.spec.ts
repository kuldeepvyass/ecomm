import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { dismissCookies, signIn } from "./helpers";

const PAGES = [
  "/",
  "/watches",
  "/watches?gender=WOMEN&movement=AUTOMATIC",
  "/watches/halvard/field-38-manual-wind-hv-f38",
  "/collections",
  "/search?q=chronograph",
  "/bag",
  "/sign-in",
  "/faq",
  "/refund-policy",
];

async function audit(page: import("@playwright/test").Page, url: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  for (const v of results.violations) console.log(`[axe] ${url} ${v.impact} ${v.id}: ${v.nodes.length} node(s) — ${v.nodes[0]?.target.join(" ")}`);
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`).join("\n")).toEqual([]);
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`axe — storefront (${theme})`, () => {
    for (const url of PAGES) {
      test(url, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("mh:theme", t), theme);
        await page.goto(url);
        await dismissCookies(page);
        await page.waitForLoadState("networkidle");
        await audit(page, url);
      });
    }
  });
}

test("axe — admin dashboard & products", async ({ page }) => {
  await signIn(page, "admin@e2e.test", "/admin");
  for (const url of ["/admin", "/admin/products", "/admin/pricing", "/admin/orders"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await audit(page, url);
  }
});
