"use server";

import { createElement } from "react";
import { Text } from "@react-email/components";
import { z } from "zod";
import { sendEmail } from "@/lib/email/send";
import { EmailLayout } from "@/lib/email/templates/layout";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/text";
import { readSettings } from "@/server/settings";
import { ok, runAction, type ActionResult } from "./result";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().max(20).optional(),
  message: z.string().trim().min(10, "Tell us a little more").max(3000),
});

export async function sendContactMessage(_: unknown, form: FormData): Promise<ActionResult<null>> {
  return runAction<null>(async () => {
    await enforceRateLimit("contact", await clientIp(), 5, 3600);
    const d = schema.parse(Object.fromEntries(form));
    const s = await readSettings();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
    const body = `From: ${sanitizeText(d.name, 80)} <${d.email}>${d.phone ? ` · ${sanitizeText(d.phone, 20)}` : ""}\n\n${sanitizeText(d.message, 3000)}`;
    const res = await sendEmail({
      to: s.contactEmail,
      subject: `Website enquiry from ${sanitizeText(d.name, 80)}`,
      tag: "contact",
      react: createElement(EmailLayout, { preview: "New enquiry", siteUrl }, createElement(Text, { style: { whiteSpace: "pre-wrap", fontSize: 14 } }, body)),
    });
    if (!res.ok) return { ok: false, error: `We couldn't send your message. Please email ${s.contactEmail} directly.` };
    return ok(null, "Thank you — our client services team will reply within one business day.");
  });
}
