"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { addressSchema, type AddressInput } from "@/lib/validation/address";
import { assertUser } from "@/lib/session";
import { sanitizeText } from "@/lib/text";
import { ok, runAction, UserFacingError, type ActionResult } from "./result";

export type { AddressInput };



export async function saveAddress(input: AddressInput & { id?: string }): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(async () => {
    const user = await assertUser();
    const data = addressSchema.parse(input);
    const clean = { ...data, fullName: sanitizeText(data.fullName, 80), line1: sanitizeText(data.line1, 120), city: sanitizeText(data.city, 60) };
    const count = await db.address.count({ where: { userId: user.id } });
    if (!input.id && count >= 20) throw new UserFacingError("You can save up to 20 addresses.");
    const makeDefault = clean.isDefault || count === 0;
    const saved = await db.$transaction(async (tx) => {
      if (makeDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      if (input.id) {
        const existing = await tx.address.findFirst({ where: { id: input.id, userId: user.id } });
        if (!existing) throw new UserFacingError("Address not found.");
        return tx.address.update({ where: { id: input.id }, data: { ...clean, isDefault: makeDefault || existing.isDefault } });
      }
      return tx.address.create({ data: { ...clean, isDefault: makeDefault, userId: user.id } });
    });
    revalidatePath("/account/addresses");
    return ok({ id: saved.id }, "Address saved");
  });
}

export async function deleteAddress(id: string): Promise<ActionResult<null>> {
  return runAction<null>(async () => {
    const user = await assertUser();
    const addr = await db.address.findFirst({ where: { id: z.string().cuid().parse(id), userId: user.id } });
    if (!addr) throw new UserFacingError("Address not found.");
    await db.address.delete({ where: { id: addr.id } });
    if (addr.isDefault) {
      const next = await db.address.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
      if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    revalidatePath("/account/addresses");
    return ok(null, "Address removed");
  });
}
