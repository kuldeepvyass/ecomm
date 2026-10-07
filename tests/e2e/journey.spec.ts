import { expect, test, type Browser, type Page } from "@playwright/test";
import { dismissCookies, expectToast, inr, isMobile, signIn, waitForMail } from "./helpers";

/**
 * Full journey, run on iPhone 14, Pixel 7 and desktop:
 * sign up → browse → filter → wishlist → bag → coupon → checkout → UPI pay page + UTR → admin confirms payment →
 * admin moves it through every status → customer sees timeline → review → admin approves →
 * admin changes the global discount → prices update → admin adds & deletes a product.
 */
test.describe.configure({ mode: "serial" });

const PRODUCT = { path: "/watches/halvard/field-38-manual-wind-hv-f38", name: "Field 38 Manual Wind", mrp: 18900 };
const ADMIN = "admin@e2e.test";

let customer: Page;
let admin: Page;
let email = "";
let orderNumber = "";
let orderUrl = "";
let utr = "";

async function newPage(browser: Browser, project: { use: object }) {
  const ctx = await browser.newContext({ ...project.use, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  return page;
}

test.beforeAll(async ({ browser }, info) => {
  customer = await newPage(browser, info.project);
  admin = await newPage(browser, info.project);
  email = `shopper-${info.project.name}-${Date.now()}@e2e.test`;
});

test.afterAll(async () => {
  await customer?.context().close();
  await admin?.context().close();
});

test("customer signs up with an emailed one-time code", async () => {
  await customer.goto("/");
  await dismissCookies(customer);
  await expect(customer.getByRole("heading", { level: 1 })).toBeVisible();
  await signIn(customer, email, "/account");
  await expect(customer.getByRole("heading", { name: /hello/i })).toBeVisible();
});

test("browse the shop and filter by movement", async () => {
  await customer.goto("/watches");
  await expect(customer.getByTestId("product-card").first()).toBeVisible();
  if (isMobile(customer)) {
    await customer.getByTestId("open-filters").click();
    await customer.getByRole("dialog").getByText("Movement", { exact: true }).click();
    await customer.getByRole("dialog").getByLabel("Manual wind").check();
    await customer.getByTestId("apply-filters").click();
  } else {
    const sidebar = customer.getByRole("complementary", { name: "Filters" });
    await sidebar.getByText("Movement", { exact: true }).click();
    await sidebar.getByLabel("Manual wind").check();
  }
  await expect(customer).toHaveURL(/movement=MANUAL/);
  await expect(customer.getByRole("button", { name: /Remove filter Manual wind/i })).toBeVisible();
  const cards = customer.getByTestId("product-card");
  await expect(cards.first()).toBeVisible();
  await expect(customer.getByTestId("product-grid")).toContainText(PRODUCT.name);
});

test("wishlist, then add to bag and apply a coupon", async () => {
  await customer.goto(PRODUCT.path);
  await expect(customer.getByRole("heading", { level: 1, name: PRODUCT.name })).toBeVisible();
  await customer.getByTestId("pdp-wishlist").click();
  await expectToast(customer, "Saved to wishlist");
  await customer.goto("/wishlist");
  await expect(customer.getByTestId("product-card").filter({ hasText: PRODUCT.name })).toBeVisible();

  await customer.goto(PRODUCT.path);
  await customer.getByTestId("add-to-bag").click();
  await expectToast(customer, "added to your bag");
  await customer.goto("/bag");
  await expect(customer.getByTestId("bag-line")).toHaveCount(1);
  await customer.getByTestId("coupon-input").fill("WELCOME10");
  await customer.getByRole("button", { name: "Apply" }).click();
  await expect(customer.getByTestId("coupon-discount")).toBeVisible();
});

test("checkout with a new address, pay by UPI and submit the UTR", async () => {
  await customer.getByTestId("checkout-button").first().click();
  await customer.waitForURL(/\/checkout$/);
  const form = customer.getByTestId("address-form");
  await form.getByLabel("Full name").fill("E2E Shopper");
  await form.getByLabel("Mobile number").fill("9876543210");
  await form.getByLabel("PIN code").fill("400001");
  await form.getByLabel("Flat, house no., building, street").fill("1 Marine Drive");
  await form.getByLabel("City").fill("Mumbai");
  await form.getByLabel("State").selectOption("MH");
  await form.getByRole("button", { name: "Deliver here" }).click();
  await expect(customer.getByText("E2E Shopper").first()).toBeVisible();
  await expect(customer.getByText("CGST + SGST")).toBeVisible(); // intra-state (MH → MH)

  await customer.getByTestId("place-order").click();
  // Our own UPI page: QR / app buttons, then the customer submits the 12-digit UTR.
  await customer.waitForURL(/\/checkout\/pay\//);
  await expect(customer.getByTestId("pay-amount")).toBeVisible();
  await expect(customer.getByTestId("pay-vpa")).toContainText("@");
  const t0 = Date.now() - 1000;
  await customer.getByTestId("open-utr").click();
  utr = String(Date.now()).slice(-12).padStart(12, "4");
  await customer.getByTestId("utr-input").fill(utr);
  await customer.getByTestId("submit-utr").click();
  const pending = customer.getByTestId("payment-pending");
  await expect(pending).toContainText("Payment verification pending");
  orderNumber = (await pending.textContent())!.match(/MH-\d{4}-\d{6}/)![0];
  await waitForMail(email, "order.payment_submitted", t0);
  await waitForMail("concierge@maisonhorlogere.in", "admin.payment-review", t0);
});

test("order appears in the customer's account", async () => {
  await customer.goto("/account/orders");
  await customer.getByTestId("order-row").filter({ hasText: orderNumber }).click();
  await expect(customer.getByTestId("order-number")).toHaveText(orderNumber);
  await expect(customer.getByTestId("order-status")).toHaveText("Payment verification pending");
  await expect(customer.getByTestId("payment-history")).toContainText(utr);
  orderUrl = customer.url();
});

test("admin verifies the UTR and confirms the payment", async () => {
  await signIn(admin, ADMIN, "/admin");
  await admin.goto("/admin/payments");
  const card = admin.getByTestId("payments-to-verify").locator("li", { hasText: orderNumber });
  await expect(card.getByTestId("review-utr")).toHaveText(utr);
  const t0 = Date.now() - 1000;
  admin.once("dialog", (d) => d.accept());
  await card.getByTestId("confirm-payment").click();
  await expectToast(admin, "Payment confirmed");
  await waitForMail(email, "order.paid", t0);
  await customer.goto(orderUrl);
  await expect(customer.getByTestId("order-status")).toHaveText("Payment confirmed");
});

test("admin moves the order through every stage", async () => {
  await admin.goto(`/admin/orders?q=${orderNumber}`);
  await admin.getByRole("link", { name: orderNumber }).click();
  const stages: [string, string][] = [["PROCESSING", "Being prepared"], ["SHIPPED", "Shipped"], ["OUT_FOR_DELIVERY", "Out for delivery"], ["DELIVERED", "Delivered"]];
  for (const [value, label] of stages) {
    const t0 = Date.now() - 1000;
    await admin.getByTestId("admin-next-status").selectOption(value);
    if (value === "SHIPPED") {
      const panel = admin.locator("section", { has: admin.getByTestId("admin-next-status") });
      await panel.getByLabel("Courier").selectOption("Blue Dart");
      await panel.getByTestId("admin-awb").fill("BD999E2E");
      await panel.getByLabel("Tracking link").fill("https://www.bluedart.com/tracking?awb=BD999E2E");
    }
    await admin.getByTestId("admin-update-status").click();
    await expect(admin.getByTestId("order-status").first()).toHaveText(label);
    await waitForMail(email, `order.${value.toLowerCase()}`, t0);
  }
});

test("customer sees the full timeline with tracking", async () => {
  await customer.goto(orderUrl);
  await expect(customer.getByTestId("order-status")).toHaveText("Delivered");
  await expect(customer.getByText("BD999E2E").first()).toBeVisible();
  const timeline = customer.getByTestId("order-timeline");
  for (const step of ["Payment confirmed", "Being prepared", "Shipped", "Out for delivery", "Delivered"]) await expect(timeline).toContainText(step);
});

test("customer reviews the watch and admin approves it", async () => {
  await customer.getByTestId("write-review").first().click();
  const form = customer.getByTestId("review-form");
  await form.getByTestId("star-5").click();
  const title = `Superb daily wearer ${Date.now()}`;
  await form.getByLabel("Title").fill(title);
  await form.getByLabel("Your review").fill("Wears beautifully, keeps excellent time and the finishing is lovely for the price.");
  await form.getByRole("button", { name: "Submit review" }).click();
  await customer.waitForURL(/\/account\/reviews$/);
  await expect(customer.getByText(title)).toBeVisible();

  await admin.goto("/admin/reviews?status=PENDING");
  const card = admin.getByTestId("admin-reviews").locator("li", { hasText: title });
  await card.getByTestId("approve-review").click();
  await expectToast(admin, "Review published");

  await expect(async () => {
    await customer.goto(`${PRODUCT.path}#reviews`);
    await customer.getByRole("combobox", { name: /sort reviews/i }).selectOption("newest");
    await expect(customer.locator("#reviews")).toContainText(title, { timeout: 5000 });
  }).toPass({ timeout: 30_000 });
  await expect(customer.locator("#reviews")).toContainText("Verified Purchase");
});

test("admin changes the global discount and prices update everywhere", async () => {
  const pct = 12;
  const expected = Math.round(PRODUCT.mrp * (1 - pct / 100));
  await admin.goto("/admin/pricing");
  await admin.getByTestId("global-discount-input").fill(String(pct));
  await admin.getByTestId("preview-discount").click();
  await expect(admin.getByTestId("discount-preview")).toContainText(inr(expected));
  await admin.getByTestId("apply-discount").click();
  await expectToast(admin, `Global discount set to ${pct}%`);

  await expect(async () => {
    await customer.goto(PRODUCT.path);
    await expect(customer.getByText(inr(expected)).first()).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await customer.goto("/watches?movement=MANUAL");
  await expect(customer.getByTestId("product-card").filter({ hasText: PRODUCT.name })).toContainText(inr(expected));

  // Restore the seeded 5% so other projects start from the same state.
  await admin.goto("/admin/pricing");
  await admin.getByTestId("global-discount-input").fill("5");
  await admin.getByTestId("preview-discount").click();
  await admin.getByTestId("apply-discount").click();
  await expectToast(admin, "Global discount set to 5%");
});

test("admin adds a product with an image, then deletes it", async ({}, info) => {
  const sku = `E2E-${info.project.name}-${Date.now()}`.toUpperCase();
  const model = `Test Chronometer ${Date.now()}`;
  await admin.goto("/admin/products/new");
  const form = admin.getByTestId("product-form");
  await form.getByRole("combobox", { name: "Brand", exact: true }).fill("Halvard");
  await form.getByLabel("Model name").fill(model);
  await form.getByLabel("Reference number").fill(sku);
  await form.getByRole("textbox", { name: "SKU", exact: true }).fill(sku);
  await form.getByRole("textbox", { name: "Description", exact: true }).fill("A test product created by the end-to-end suite.");
  await form.locator('input[type="file"]').setInputFiles("tests/e2e/fixtures/watch.jpg");
  await expect(form.getByText("Cover")).toBeVisible({ timeout: 30_000 });
  await form.getByLabel("MRP (₹)").fill("45000");
  await form.getByLabel("Stock quantity").fill("3");
  await form.getByLabel("Case material").fill("Stainless steel");
  await form.getByLabel("Case diameter (mm)").fill("39");
  await form.getByLabel("Dial colour").fill("Silver");
  await form.getByLabel("Strap / bracelet material").fill("Calf leather");
  await form.getByRole("combobox", { name: "Status", exact: true }).selectOption("ACTIVE");
  await admin.getByTestId("save-product").click();
  await expectToast(admin, "Product created");
  await admin.waitForURL(/\/admin\/products\/c[a-z0-9]+$/);

  const viewHref = await admin.getByRole("link", { name: "View in store" }).getAttribute("href");
  expect(viewHref).toBeTruthy();
  await customer.goto(viewHref!);
  await expect(customer.getByRole("heading", { level: 1, name: model })).toBeVisible();
  await expect(customer.getByText(inr(Math.round(45000 * 0.95))).first()).toBeVisible();

  await admin.goto(`/admin/products?q=${sku}`);
  await admin.getByRole("checkbox", { name: `Select ${model}` }).check();
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Delete", exact: true }).click();
  await expectToast(admin, "1 product updated");
  await expect(async () => {
    const res = await customer.goto(viewHref!);
    expect(res?.status()).toBe(404);
  }).toPass({ timeout: 30_000 });
});
