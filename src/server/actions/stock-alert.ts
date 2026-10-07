"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { ok, runAction, type ActionResult } from "./result";

const schema = z.object({ productId: z.string().cuid(), email: z.email("Enter a valid email").max(200) });

export async function requestStockAlert(_: unknown, form: FormData): Promise<ActionResult<null>> {
  return runAction<null>(async () => {
    await enforceRateLimit("stock-alert", await clientIp(), 10, 3600);
    const user = await getSessionUser();
    const { productId, email } = schema.parse({ productId: form.get("productId"), email: String(form.get("email") ?? user?.email ?? "").trim().toLowerCase() });
    await db.stockAlert.upsert({
      where: { productId_email: { productId, email } },
      create: { productId, email, userId: user?.id },
      update: { notifiedAt: null },
    });
    return ok(null, "We'll email you the moment it's back.");
  });
}
