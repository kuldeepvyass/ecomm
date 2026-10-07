import "server-only";
import { z } from "zod";

/**
 * Server environment. Every third-party service is optional so the store runs on
 * localhost without credentials; features degrade to safe dev fallbacks instead.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_EMAILS: z.string().default(""),

  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Maison Horlogère <onboarding@resend.dev>"),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  E2E_TEST_MODE: z.enum(["0", "1"]).default("0"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables", z.flattenError(parsed.error).fieldErrors);
  throw new Error("Invalid environment variables — see .env.example");
}

export const env = parsed.data;

export const features = {
  google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
  resend: Boolean(env.RESEND_API_KEY),
  cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  sentry: Boolean(env.SENTRY_DSN),
} as const;

export const adminEmails = new Set(
  env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);
