import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetCatalog, testDb } from "./helpers";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock("@/lib/session", () => ({ getSessionUser: async () => null, assertUser: async () => { throw new Error("no"); } }));
vi.mock("@/auth", () => ({ auth: async () => null }));
const db = testDb();
vi.mock("@/lib/db", () => ({ db }));

const { decrementStock, restoreStock, OutOfStockError } = await import("@/server/orders/service");

let productId = "";
beforeAll(async () => {
  await resetCatalog(db);
  const brand = await db.brand.create({ data: { name: "Test", slug: "test" } });
  const p = await db.product.create({
    data: {
      brandId: brand.id, modelName: "Solo", referenceNumber: "S1", slug: "solo", sku: "SOLO", description: "x".repeat(20), gender: "MEN",
      mrp: 100000, sellingPrice: 100000, stock: 3, caseMaterial: "Steel", caseDiameterMm: 40, dialColour: "Black", strapMaterial: "Leather", movement: "QUARTZ",
    },
  });
  productId = p.id;
});
afterAll(() => db.$disconnect());

describe("stock handling", () => {
  it("never oversells under concurrent payments", async () => {
    const attempts = Array.from({ length: 10 }, () =>
      db.$transaction((tx) => decrementStock(tx, [{ productId, quantity: 1, modelName: "Solo" }])).then(() => "ok", (e) => (e instanceof OutOfStockError ? "oos" : "err")),
    );
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r === "ok")).toHaveLength(3);
    expect(results.filter((r) => r === "oos")).toHaveLength(7);
    const p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(p.stock).toBe(0);
    expect(p.soldCount).toBe(3);
  });

  it("rolls back every line when one line is out of stock", async () => {
    await db.product.update({ where: { id: productId }, data: { stock: 1 } });
    await expect(
      db.$transaction((tx) => decrementStock(tx, [{ productId, quantity: 1, modelName: "Solo" }, { productId, quantity: 1, modelName: "Solo" }])),
    ).rejects.toBeInstanceOf(OutOfStockError);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(1);
  });

  it("restores stock on cancel and reports products that came back in stock", async () => {
    await db.product.update({ where: { id: productId }, data: { stock: 0, soldCount: 3 } });
    const restocked = await db.$transaction((tx) => restoreStock(tx, [{ productId, quantity: 2 }]));
    expect(restocked).toEqual([productId]);
    const p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(p.stock).toBe(2);
    expect(p.soldCount).toBe(1);
  });
});
