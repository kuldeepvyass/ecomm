import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Atomic gap-free counter (single upsert). */
export async function nextSequence(tx: Tx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return rows[0].value;
}

/** Indian financial year label, e.g. 2026-10-06 → "26-27". */
export function financialYear(d = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

export async function nextOrderNumber(tx: Tx, d = new Date()) {
  const year = d.getFullYear();
  const n = await nextSequence(tx, `order:${year}`);
  return `MH-${year}-${String(n).padStart(6, "0")}`;
}

export async function nextInvoiceNumber(tx: Tx, d = new Date()) {
  const fy = financialYear(d);
  const n = await nextSequence(tx, `invoice:${fy}`);
  return `MH/${fy}/${String(n).padStart(6, "0")}`;
}
