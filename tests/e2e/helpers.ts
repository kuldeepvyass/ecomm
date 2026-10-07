import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const MAIL_DIR = path.join(process.cwd(), ".dev-mail");

type Mail = { to: string; subject: string; tag: string; sentAt: string; html: string };

/** Polls the local dev mailbox (E2E_TEST_MODE writes emails there) for the newest matching email. */
export async function waitForMail(to: string, tag: string, after: number, timeout = 20_000): Promise<Mail> {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      const files = (await readdir(MAIL_DIR)).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 200);
      for (const f of files) {
        const m: Mail = JSON.parse(await readFile(path.join(MAIL_DIR, f), "utf8"));
        if (m.to === to && m.tag === tag && Date.parse(m.sentAt) >= after) return m;
      }
    } catch {
      /* dir not created yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`No "${tag}" email for ${to}`);
}

export async function signIn(page: Page, email: string, callbackUrl = "/account") {
  const t0 = Date.now() - 1000;
  await page.goto(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await dismissCookies(page);
  await page.getByLabel("Email address", { exact: false }).first().fill(email);
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.waitForURL(/\/sign-in\/verify/);
  const mail = await waitForMail(email, "auth.sign-in", t0);
  const code = mail.subject.match(/\b(\d{6})\b/)![1];
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: /verify/i }).click();
  await page.waitForURL((u) => u.pathname === callbackUrl || u.pathname.startsWith(callbackUrl), { timeout: 30_000 });
}

export function inr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1200) < 768;

export async function dismissCookies(page: Page) {
  const btn = page.getByRole("button", { name: "Essential only" });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}
