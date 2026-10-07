import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { reportError } from "@/lib/logger";

/** Records an admin (or system) action. Never throws — auditing must not break the action. */
export async function logAudit(entry: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  diff?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
}) {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
    } catch {
      /* outside a request (scripts) */
    }
    await (entry.tx ?? db).auditLog.create({
      data: { actorId: entry.actorId, action: entry.action, entityType: entry.entityType, entityId: entry.entityId ?? null, diff: entry.diff, ip, userAgent },
    });
  } catch (e) {
    reportError(e, { where: "logAudit", action: entry.action });
  }
}

/** Builds a {field: [old, new]} diff of changed scalar fields. */
export function diffObjects(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(after)) {
    const a = before[k];
    const b = after[k];
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? ""));
    if (norm(a) !== norm(b)) out[k] = [a ?? null, b ?? null];
  }
  return out;
}
