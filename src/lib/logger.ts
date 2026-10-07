import pino from "pino";

/** Structured JSON logs (pretty enough in dev; machine-readable on Vercel). */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { app: "maison-horlogere" },
  redact: ["*.password", "*.token", "*.email"],
});

/** Error reporting hook — forwards to Sentry when configured (see instrumentation.ts). */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  logger.error({ err: error, ...context }, error instanceof Error ? error.message : "error");
  const hook = (globalThis as { __reportError?: (e: unknown, c: Record<string, unknown>) => void }).__reportError;
  hook?.(error, context);
}
