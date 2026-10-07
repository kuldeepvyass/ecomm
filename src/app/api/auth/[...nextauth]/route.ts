import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export const GET = async (req: NextRequest) => {
  // Throttle code/link verification attempts per IP (the per-email cap lives in the adapter).
  if (req.nextUrl.pathname.includes("/callback/resend")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const r = await rateLimit(`auth-verify:${ip}`, 20, 15 * 60);
    if (!r.ok) return Response.redirect(new URL("/sign-in?error=RateLimited", req.url));
  }
  return handlers.GET(req);
};

export const POST = async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const r = await rateLimit(`auth:${ip}`, 20, 15 * 60);
  if (!r.ok) return Response.json({ error: "Too many requests" }, { status: 429 });
  return handlers.POST(req);
};
