"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { ok, runAction, type ActionResult } from "./result";

const schema = z.object({ email: z.email("Enter a valid email address").max(200) });

export async function subscribeNewsletter(_: unknown, form: FormData): Promise<ActionResult<null>> {
  return runAction(async () => {
    await enforceRateLimit("newsletter", await clientIp(), 5, 3600);
    const { email } = schema.parse({ email: String(form.get("email") ?? "").trim().toLowerCase() });
    await db.newsletterSubscriber.upsert({
      where: { email },
      create: { email, confirmedAt: new Date() },
      update: { unsubscribedAt: null, confirmedAt: new Date() },
    });
    return ok(null, "You're on the list. Expect new arrivals and private previews.");
  });
}
