import "server-only";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** For pages: redirects to sign-in, preserving where the user was going. */
export async function requireUser(returnTo = "/account") {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?callbackUrl=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Use in every admin page AND every admin server action — never rely on layout alone. */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?callbackUrl=/admin");
  if (user.role !== "ADMIN") forbidden();
  return user;
}

export class AuthError extends Error {}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertUser() {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Please sign in to continue.");
  return user;
}

export async function assertAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") throw new AuthError("Admin access required.");
  return user;
}
