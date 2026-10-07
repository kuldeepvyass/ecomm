import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { OtpForm } from "./otp-form";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

export default async function VerifyPage({ searchParams }: PageProps<"/sign-in/verify">) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  const callbackUrl = typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/") ? sp.callbackUrl : "/account";
  const isDev = process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY;

  return (
    <div className="container-luxe flex justify-center py-16 md:py-24">
      <div className="w-full max-w-md text-center">
        <MailCheck className="mx-auto mb-6 size-10 text-gold" aria-hidden />
        <h1 className="text-4xl md:text-5xl">Check your email</h1>
        <p className="mt-3 text-fg-muted">
          {email ? <>We sent a 6-digit code to <strong className="text-fg">{email}</strong>.</> : "We sent you a 6-digit code."} Enter it below, or tap the link in the email.
        </p>
        {isDev && (
          <p className="mt-4 text-sm text-fg-subtle">
            Local dev: no email service configured — open the <Link href="/dev/mail" className="text-gold underline" target="_blank">dev mailbox</Link>.
          </p>
        )}
        <OtpForm email={email} callbackUrl={callbackUrl} />
        <Link href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="mt-8 inline-flex min-h-11 items-center text-sm text-fg-muted hover:text-gold">
          Use a different email or resend
        </Link>
      </div>
    </div>
  );
}
