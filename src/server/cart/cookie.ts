import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const GUEST_CART_COOKIE = "mh_cart";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function readGuestToken(): Promise<string | null> {
  const value = (await cookies()).get(GUEST_CART_COOKIE)?.value;
  return value && /^[a-f0-9]{48}$/.test(value) ? value : null;
}

export async function ensureGuestToken(): Promise<string> {
  const existing = await readGuestToken();
  if (existing) return existing;
  const token = randomBytes(24).toString("hex");
  (await cookies()).set(GUEST_CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https:"),
    path: "/",
    maxAge: MAX_AGE,
  });
  return token;
}

export async function clearGuestToken() {
  (await cookies()).delete(GUEST_CART_COOKIE);
}
