import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: Date };

/**
 * Fixed-window limiter backed by Postgres (one upsert per call). Good enough for
 * auth/search/checkout/review abuse protection without another service.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  if (process.env.E2E_TEST_MODE === "1") return { ok: true, remaining: limit, resetAt: new Date() };
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const { count, resetAt } = rows[0];
  return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please wait a moment and try again.");
  }
}

/** Throws RateLimitError when exceeded. */
export async function enforceRateLimit(bucket: string, id: string, limit: number, windowSeconds: number) {
  const r = await rateLimit(`${bucket}:${id}`, limit, windowSeconds);
  if (!r.ok) throw new RateLimitError();
}
