import type { Metadata } from "next";
import { Monogram } from "@/components/brand/logo";
import { testLoginEnabled } from "@/lib/dev/test-accounts";
import { SignInForm } from "./sign-in-form";
import { TestAccounts } from "./test-accounts";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  Verification: "That code or link has expired or was already used. Request a new one.",
  Blocked: "This account has been suspended. Please contact client services.",
  Deleted: "This account was deleted.",
  RateLimited: "Too many attempts. Please wait a few minutes.",
  OAuthAccountNotLinked: "This email is already registered with a different sign-in method.",
  AccessDenied: "Access denied.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : "/account";
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? "Sign-in failed. Please try again.") : undefined;
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="container-luxe flex justify-center py-16 md:py-24">
      <div className="w-full max-w-md">
        <Monogram className="mx-auto mb-6 size-12 text-gold" />
        <h1 className="text-center text-4xl md:text-5xl">Welcome</h1>
        <p className="mt-3 text-center text-fg-muted">
          Sign in or create an account to track orders, save your wishlist and check out faster.
        </p>
        {error && <p role="alert" className="mt-6 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
        <SignInForm callbackUrl={callbackUrl} googleEnabled={googleEnabled} />
        {testLoginEnabled() && <TestAccounts callbackUrl={typeof sp.callbackUrl === "string" ? sp.callbackUrl : undefined} />}
      </div>
    </div>
  );
}
