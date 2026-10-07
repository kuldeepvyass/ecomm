import { randomInt } from "node:crypto";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { createElement } from "react";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { SignInEmail } from "@/lib/email/templates/sign-in";
import { mergeGuestStateIntoUser } from "@/server/cart/merge";

const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_SECONDS = 10 * 60;

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

/**
 * Prisma adapter with OTP brute-force protection: a lookup must include the email,
 * and each failed attempt for that email counts toward a cap that burns the code.
 */
function createAdapter(): Adapter {
  const base = PrismaAdapter(db) as Adapter;
  return {
    ...base,
    async useVerificationToken({ identifier, token }) {
      if (!identifier) return null;
      const row = await db.verificationToken.findUnique({ where: { identifier_token: { identifier, token } } });
      if (!row) {
        await db.verificationToken.updateMany({ where: { identifier }, data: { attempts: { increment: 1 } } });
        await db.verificationToken.deleteMany({ where: { identifier, attempts: { gte: MAX_OTP_ATTEMPTS } } });
        return null;
      }
      await db.verificationToken.deleteMany({ where: { identifier } }); // single use; invalidate older codes too
      return { identifier: row.identifier, token: row.token, expires: row.expires };
    },
  };
}

const providers = [
  Resend({
    apiKey: process.env.RESEND_API_KEY ?? "unset",
    from: process.env.EMAIL_FROM,
    maxAge: OTP_TTL_SECONDS,
    // One token serves both as the 6-digit code and the magic-link token.
    generateVerificationToken: () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
    async sendVerificationRequest({ identifier, url, token }) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(url).origin;
      const res = await sendEmail({
        to: identifier,
        subject: `${token} is your Maison Horlogère sign-in code`,
        tag: "auth.sign-in",
        react: createElement(SignInEmail, { code: token, url, siteUrl }),
      });
      if (!res.ok) throw new Error("Could not send sign-in email");
    },
  }),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ allowDangerousEmailAccountLinking: true })] // Google verifies email ownership
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAdapter(),
  providers,
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/sign-in", verifyRequest: "/sign-in/verify", error: "/sign-in" },
  trustHost: true,
  callbacks: {
    async signIn({ user }) {
      if (user.blockedAt) return "/sign-in?error=Blocked";
      if (user.deletedAt) return "/sign-in?error=Deleted";
      return true;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role ?? "CUSTOMER";
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id || !user.email) return;
      if (adminEmails().has(user.email.toLowerCase()) && user.role !== "ADMIN") {
        await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      }
      await mergeGuestStateIntoUser(user.id);
    },
  },
});
