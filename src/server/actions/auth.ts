"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { runAction, type ActionResult } from "./result";

const safeCallback = z
  .string()
  .default("/account")
  .transform((v) => (v.startsWith("/") && !v.startsWith("//") ? v : "/account"));

const emailSchema = z.object({
  email: z.email("Enter a valid email address").max(200).transform((e) => e.trim().toLowerCase()),
  callbackUrl: safeCallback,
});

/** Sends the OTP + magic link, then moves to the code entry screen. */
export async function requestEmailSignIn(_: unknown, form: FormData): Promise<ActionResult<null>> {
  const result = await runAction<{ email: string; callbackUrl: string }>(async () => {
    const { email, callbackUrl } = emailSchema.parse({
      email: String(form.get("email") ?? ""),
      callbackUrl: form.get("callbackUrl") || undefined,
    });
    await enforceRateLimit("signin-ip", await clientIp(), 10, 15 * 60);
    await enforceRateLimit("signin-email", email, 5, 60 * 60);
    const user = await db.user.findUnique({ where: { email }, select: { blockedAt: true } });
    if (user?.blockedAt) return { ok: false, error: "This account has been suspended. Please contact support." };
    await signIn("resend", { email, redirect: false, redirectTo: callbackUrl });
    return { ok: true, data: { email, callbackUrl } };
  });
  if (!result.ok) return result;
  redirect(`/sign-in/verify?${new URLSearchParams({ email: result.data.email, callbackUrl: result.data.callbackUrl })}`);
}

export async function signInWithGoogle(form: FormData) {
  const callbackUrl = safeCallback.parse(form.get("callbackUrl") || undefined);
  await signIn("google", { redirectTo: callbackUrl });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
