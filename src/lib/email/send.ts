import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { logger, reportError } from "@/lib/logger";

export type OutgoingEmail = {
  to: string;
  subject: string;
  react: ReactElement;
  /** Grouping tag for logs / dev mailbox, e.g. "order.shipped" */
  tag: string;
};

export const DEV_MAIL_DIR = path.join(process.cwd(), ".dev-mail");

let resend: Resend | null = null;

/**
 * Sends through Resend when RESEND_API_KEY is set. Otherwise (local dev / tests)
 * writes the rendered email to .dev-mail/ so it can be viewed at /dev/mail and read by E2E tests.
 */
export async function sendEmail(mail: OutgoingEmail): Promise<{ ok: boolean }> {
  try {
    const html = await render(mail.react);
    const text = await render(mail.react, { plainText: true });
    const apiKey = process.env.RESEND_API_KEY;

    if (apiKey && process.env.E2E_TEST_MODE !== "1") {
      resend ??= new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "Maison Horlogère <onboarding@resend.dev>",
        to: mail.to,
        subject: mail.subject,
        html,
        text,
        tags: [{ name: "type", value: mail.tag.replace(/[^a-zA-Z0-9_-]/g, "_") }],
      });
      if (error) throw new Error(`Resend: ${error.message}`);
      logger.info({ tag: mail.tag }, "email sent");
      return { ok: true };
    }

    if (process.env.NODE_ENV === "production" && process.env.E2E_TEST_MODE !== "1") {
      logger.warn({ tag: mail.tag }, "RESEND_API_KEY missing — email not sent");
      return { ok: false };
    }

    await mkdir(DEV_MAIL_DIR, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeFile(
      path.join(DEV_MAIL_DIR, `${id}.json`),
      JSON.stringify({ id, to: mail.to, subject: mail.subject, tag: mail.tag, html, text, sentAt: new Date().toISOString() }),
    );
    logger.info({ tag: mail.tag, subject: mail.subject }, "email captured to dev mailbox (/dev/mail)");
    return { ok: true };
  } catch (error) {
    reportError(error, { where: "sendEmail", tag: mail.tag });
    return { ok: false };
  }
}
