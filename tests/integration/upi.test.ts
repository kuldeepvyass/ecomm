import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testDb } from "./helpers";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock("@/lib/session", () => ({ getSessionUser: async () => null, assertUser: async () => { throw new Error("no"); } }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/server/orders/emails", () => ({ sendOrderStatusEmail: vi.fn(async () => {}), sendPaymentReviewAlert: vi.fn(async () => {}) }));
const db = testDb();
vi.mock("@/lib/db", () => ({ db }));

const svc = await import("@/server/orders/service");

let userId = "";
let adminId = "";
let productId = "";
let couponId = "";

async function makeOrder(n: number, opts: { dueInMs?: number } = {}) {
  await db.product.update({ where: { id: productId }, data: { stock: { decrement: 1 } } }); // reserved at placement
  const o = await db.order.create({
    data: {
      orderNumber: `MH-T-${n}-${Date.now()}`, userId, status: "PENDING_PAYMENT", paymentMethod: "UPI", idempotencyKey: crypto.randomUUID(),
      paymentDueAt: new Date(Date.now() + (opts.dueInMs ?? 30 * 60_000)), couponId, couponCode: "TEST",
      shipName: "A", shipPhone: "9876543210", shipLine1: "x", shipCity: "Mumbai", shipState: "MH", shipPincode: "400001",
      mrpTotal: 20000, itemsTotal: 19000, grandTotal: 19000, taxableValue: 16102, cgst: 1449, sgst: 1449,
      items: { create: [{ productId, brandName: "B", modelName: "M", reference: "R", sku: "S", hsnCode: "9102", gstRatePct: 18, mrp: 20000, unitPrice: 19000, quantity: 1, lineTotal: 19000 }] },
    },
  });
  await db.couponRedemption.create({ data: { couponId, userId, orderId: o.id, amount: 0 } });
  await db.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
  return o;
}

beforeAll(async () => {
  await db.$executeRawUnsafe(`TRUNCATE "Payment","Refund","OrderItem","OrderStatusEvent","CouponRedemption","Coupon","Order","Product","Brand","User","StoreSettings","AuditLog","Counter" RESTART IDENTITY CASCADE`);
  await db.storeSettings.create({ data: { id: 1, storeName: "T", contactEmail: "t@t.test", contactPhone: "1", addressLine: "x", stateCode: "MH", paymentWindowMinutes: 30 } });
  userId = (await db.user.create({ data: { email: "c@t.test" } })).id;
  adminId = (await db.user.create({ data: { email: "a@t.test", role: "ADMIN" } })).id;
  const brand = await db.brand.create({ data: { name: "B", slug: "b" } });
  productId = (await db.product.create({
    data: { brandId: brand.id, modelName: "M", referenceNumber: "R", slug: "m", sku: "S", description: "x".repeat(20), gender: "MEN", mrp: 20000, sellingPrice: 19000, stock: 10, caseMaterial: "Steel", caseDiameterMm: 40, dialColour: "Black", strapMaterial: "Leather", movement: "QUARTZ" },
  })).id;
  couponId = (await db.coupon.create({ data: { code: "TEST", type: "FLAT", value: 0 } })).id;
});
afterAll(() => db.$disconnect());

describe("UPI payments with manual UTR verification", () => {
  it("submit → confirm marks the order paid with an invoice number", async () => {
    const o = await makeOrder(1);
    await svc.submitUtr(userId, o.id, { utr: "4123 4567 8901" });
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAYMENT_SUBMITTED");
    const p = await db.payment.findFirstOrThrow({ where: { orderId: o.id } });
    expect(p.utr).toBe("412345678901");
    expect(p.amountPaise).toBe(1_900_000);
    await svc.confirmUpiPayment(p.id, adminId);
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(after.status).toBe("PAID");
    expect(after.invoiceNumber).toMatch(/^MH\//);
  });

  it("rejects a UTR that was already used for another payment", async () => {
    const o = await makeOrder(2);
    await expect(svc.submitUtr(userId, o.id, { utr: "412345678901" })).rejects.toBeInstanceOf(svc.DuplicateUtrError);
    await expect(svc.submitUtr(userId, o.id, { utr: "123" })).rejects.toThrow(/12-digit/);
  });

  it("rejection gives the customer another window to resubmit, then confirm works", async () => {
    const o = await makeOrder(3);
    await svc.submitUtr(userId, o.id, { utr: "500000000001" });
    const first = await db.payment.findFirstOrThrow({ where: { orderId: o.id } });
    await svc.rejectUpiPayment(first.id, adminId, "Amount doesn't match");
    const rejected = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(rejected.status).toBe("PAYMENT_FAILED");
    expect(rejected.paymentDueAt!.getTime()).toBeGreaterThan(Date.now());
    await svc.submitUtr(userId, o.id, { utr: "500000000002" });
    const second = await db.payment.findFirstOrThrow({ where: { orderId: o.id, utr: "500000000002" } });
    await svc.confirmUpiPayment(second.id, adminId);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
  });

  it("expires unpaid orders, releasing stock and the coupon — but never one awaiting review", async () => {
    const stockBefore = (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock;
    const usedBefore = (await db.coupon.findUniqueOrThrow({ where: { id: couponId } })).usedCount;
    const unpaid = await makeOrder(4, { dueInMs: -1000 });
    const waiting = await makeOrder(5, { dueInMs: -1000 });
    await svc.submitUtr(userId, waiting.id, { utr: "731000000001" });
    await svc.expireUnpaidOrders();
    expect((await db.order.findUniqueOrThrow({ where: { id: unpaid.id } })).status).toBe("CANCELLED");
    expect((await db.order.findUniqueOrThrow({ where: { id: waiting.id } })).status).toBe("PAYMENT_SUBMITTED");
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(stockBefore - 1); // only `waiting` still holds a unit
    expect((await db.coupon.findUniqueOrThrow({ where: { id: couponId } })).usedCount).toBe(usedBefore + 1);
    await expect(svc.submitUtr(userId, unpaid.id, { utr: "731000000002" })).rejects.toThrow(/no longer needs payment/);
  });

  it("only the order's owner can submit a UTR", async () => {
    const o = await makeOrder(6);
    await expect(svc.submitUtr(adminId, o.id, { utr: "700000000001" })).rejects.toThrow(/not found/i);
  });
});

describe("cancellation refunds go to the customer's bank account", () => {
  const bank = { accountHolder: "Test Customer", accountNumber: "123456789012", ifsc: "HDFC0001234", bankName: "HDFC Bank", bankBranch: "Fort, Mumbai" };

  async function paidOrder(n: number, utr: string) {
    const o = await makeOrder(n);
    await svc.submitUtr(userId, o.id, { utr, payerVpa: "buyer@okaxis" });
    const p = await db.payment.findFirstOrThrow({ where: { orderId: o.id } });
    await svc.confirmUpiPayment(p.id, adminId);
    return o;
  }

  it("a paid order can't be cancelled without bank details", async () => {
    const o = await paidOrder(20, "918200000001");
    await expect(svc.cancelByCustomer(userId, o.id, "Changed my mind")).rejects.toThrow(/bank account/);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
  });

  it("cancel with bank details → pending refund carrying them; sending it erases all but the last 4 digits", async () => {
    const o = await paidOrder(21, "918200000002");
    await svc.cancelByCustomer(userId, o.id, "Changed my mind", bank);
    const r = await db.refund.findFirstOrThrow({ where: { orderId: o.id } });
    expect(r).toMatchObject({ status: "PENDING", amount: 19000, accountNumber: "123456789012", accountLast4: "9012", ifsc: "HDFC0001234", bankName: "HDFC Bank" });
    expect(r.bankDetailsAt).toBeInstanceOf(Date);

    await svc.completeRefund(r.id, "IMPS123456", adminId);
    const done = await db.refund.findUniqueOrThrow({ where: { id: r.id } });
    expect(done).toMatchObject({ status: "PROCESSED", reference: "IMPS123456", accountNumber: null, accountLast4: "9012" });
    expect(done.processedAt).toBeInstanceOf(Date);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("REFUNDED");
  });

  it("store-cancelled refund: only the owner can add bank details, and only while a refund is pending", async () => {
    const o = await paidOrder(22, "918200000003");
    await svc.transitionOrder(o.id, "CANCELLED", { id: adminId, label: "admin" }, { note: "Cancelled by store: test" });
    await svc.issueRefund(o.id, null, "Cancelled by store", adminId);
    expect((await db.refund.findFirstOrThrow({ where: { orderId: o.id } })).bankDetailsAt).toBeNull();

    await expect(svc.setRefundBankDetails(adminId, o.id, bank)).rejects.toThrow(/not found/i);
    await svc.setRefundBankDetails(userId, o.id, bank);
    const r = await db.refund.findFirstOrThrow({ where: { orderId: o.id } });
    expect(r.accountLast4).toBe("9012");

    await svc.completeRefund(r.id, "NEFT998877", adminId);
    await expect(svc.setRefundBankDetails(userId, o.id, bank)).rejects.toThrow(/no refund waiting/i);
  });

  it("an unpaid order cancels without bank details and creates no refund", async () => {
    const o = await makeOrder(23);
    await svc.cancelByCustomer(userId, o.id, "Ordered by mistake");
    expect(await db.refund.count({ where: { orderId: o.id } })).toBe(0);
  });
});
