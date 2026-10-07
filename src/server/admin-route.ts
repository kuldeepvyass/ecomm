import "server-only";
import { auth } from "@/auth";

/** Route-handler guard: returns the admin user or a 401/403 Response. */
export async function adminOrResponse() {
  const session = await auth();
  if (!session?.user) return { error: Response.json({ error: "Sign in required" }, { status: 401 }) } as const;
  if (session.user.role !== "ADMIN") return { error: Response.json({ error: "Forbidden" }, { status: 403 }) } as const;
  return { user: session.user } as const;
}
