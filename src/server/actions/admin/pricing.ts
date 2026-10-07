"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache-tags";
import { priceFor } from "@/lib/pricing";
import { assertAdmin } from "@/lib/session";
import { logAudit } from "@/server/audit";
import { currentGlobalPct, repriceAll, revalidateCatalog } from "@/server/catalog/admin";
import { ok, runAction, type ActionResult } from "../result";

const pctSchema = z.coerce.number().min(0, "Discount can't be negative").max(90, "Maximum is 90%").refine((v) => Math.round(v * 100) === v * 100, "Use at most 2 decimals");

export type DiscountPreview = {
  oldPct: number;
  newPct: number;
  affected: number;
  unaffected: number;
  samples: { id: string; name: string; mrp: number; oldPrice: number; newPrice: number; note: string | null }[];
};

/** Dry run: what every product's price would become. Nothing is written. */
export async function previewGlobalDiscount(pct: number): Promise<ActionResult<DiscountPreview>> {
  return runAction(async () => {
    await assertAdmin();
    const newPct = pctSchema.parse(pct);
    const oldPct = await currentGlobalPct();
    const products = await db.product.findMany({
      where: { deletedAt: null },
      select: { id: true, modelName: true, mrp: true, sellingPrice: true, discountOverridePct: true, excludeFromGlobalDiscount: true, brand: { select: { name: true } } },
      orderBy: { mrp: "desc" },
    });
    const rows = products.map((p) => {
      const input = { mrp: p.mrp, discountOverridePct: p.discountOverridePct === null ? null : Number(p.discountOverridePct), excludeFromGlobalDiscount: p.excludeFromGlobalDiscount };
      return {
        id: p.id, name: `${p.brand.name} ${p.modelName}`, mrp: p.mrp, oldPrice: p.sellingPrice, newPrice: priceFor(input, newPct).price,
        note: input.discountOverridePct !== null ? `Own discount ${input.discountOverridePct}% (unchanged)` : p.excludeFromGlobalDiscount ? "Excluded from global discount" : null,
      };
    });
    const affected = rows.filter((r) => r.oldPrice !== r.newPrice);
    return ok({ oldPct, newPct, affected: affected.length, unaffected: rows.length - affected.length, samples: [...affected, ...rows.filter((r) => r.oldPrice === r.newPrice)].slice(0, 50) });
  });
}

export async function applyGlobalDiscount(pct: number): Promise<ActionResult<{ affected: number }>> {
  return runAction(async () => {
    const admin = await assertAdmin();
    const newPct = pctSchema.parse(pct);
    const batchId = randomUUID();
    const { oldPct, changes } = await db.$transaction(async (tx) => {
      const oldPct = await currentGlobalPct(tx);
      await tx.storeSettings.update({ where: { id: 1 }, data: { globalDiscountPct: newPct } });
      const changes = await repriceAll(tx, newPct);
      await tx.priceChangeLog.create({ data: { scope: "GLOBAL_DISCOUNT", actorId: admin.id, oldValue: `${oldPct}%`, newValue: `${newPct}%`, affectedCount: changes.length, batchId } });
      if (changes.length) {
        await tx.priceChangeLog.createMany({
          data: changes.map((c) => ({ scope: "GLOBAL_DISCOUNT" as const, actorId: admin.id, productId: c.id, oldValue: `${oldPct}%`, newValue: `${newPct}%`, oldPrice: c.oldPrice, newPrice: c.newPrice, batchId })),
        });
      }
      return { oldPct, changes };
    }, { timeout: 30_000 });
    await logAudit({ actorId: admin.id, action: "pricing.global", entityType: "StoreSettings", entityId: "1", diff: { globalDiscountPct: [oldPct, newPct], productsRepriced: [null, changes.length] } });
    revalidateTag(TAGS.settings, "max");
    revalidateCatalog();
    return ok({ affected: changes.length }, `Global discount set to ${newPct}% — ${changes.length} prices updated`);
  });
}
