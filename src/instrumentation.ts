import type { Instrumentation } from "next";

/**
 * Server error hook. Logs every uncaught server error as structured JSON (picked up by
 * Vercel logs). To forward to Sentry: `npx @sentry/wizard@latest -i nextjs`, set SENTRY_DSN,
 * and the wizard's `Sentry.captureRequestError` can be called here (see README → Monitoring).
 */
export async function register() {}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      app: "maison-horlogere",
      msg: e?.message ?? String(err),
      digest: e?.digest,
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      stack: process.env.NODE_ENV === "production" ? undefined : e?.stack,
    }),
  );
  const hook = (globalThis as { __reportError?: (e: unknown, c: Record<string, unknown>) => void }).__reportError;
  hook?.(err, { path: request.path, digest: e?.digest });
};
