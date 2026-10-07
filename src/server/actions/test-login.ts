"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TEST_ACCOUNTS, testLoginEnabled } from "@/lib/dev/test-accounts";
import { mergeGuestStateIntoUser } from "@/server/cart/merge";

const SESSION_DAYS = 30;

/**
 * Dev-only one-click sign-in for the seeded test accounts (no OTP). Creates a normal Auth.js
 * database session, so everything downstream behaves exactly as after a real sign-in.
 */
export async function testSignIn(form: FormData) {
  if (!testLoginEnabled()) throw new Error("Test sign-in is disabled");
  const account = TEST_ACCOUNTS.find((a) => a.email === String(form.get("email")));
  if (!account) throw new Error("Unknown test account");
  const raw = String(form.get("callbackUrl") ?? "");
  const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : account.role === "ADMIN" ? "/admin" : "/account";

  const user = await db.user.upsert({
    where: { email: account.email },
    create: { email: account.email, name: account.name, role: account.role, emailVerified: new Date() },
    update: { role: account.role, blockedAt: null, deletedAt: null },
  });
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({ data: { sessionToken, userId: user.id, expires } });

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production" && (process.env.AUTH_URL ?? "").startsWith("https");
  jar.set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", sessionToken, { httpOnly: true, sameSite: "lax", path: "/", secure, expires });
  await mergeGuestStateIntoUser(user.id);
  redirect(callbackUrl);
}
