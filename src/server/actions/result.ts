import { z } from "zod";
import { AuthError } from "@/lib/session";
import { RateLimitError } from "@/lib/rate-limit";
import { reportError } from "@/lib/logger";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export class UserFacingError extends Error {}

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

/** Wraps a server action body: maps known errors to friendly messages, reports the rest. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors: z.flattenError(e).fieldErrors as Record<string, string[]> };
    }
    if (e instanceof AuthError || e instanceof RateLimitError || e instanceof UserFacingError) {
      return { ok: false, error: e.message };
    }
    // next/navigation redirect()/notFound() must propagate
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" &&
        /^NEXT_(REDIRECT|HTTP_ERROR_FALLBACK|NOT_FOUND)/.test((e as { digest: string }).digest)) throw e;
    reportError(e, { where: "server-action" });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
