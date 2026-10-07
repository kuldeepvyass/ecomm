"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Submits the code to Auth.js' email callback (same token as the magic link). */
export function OtpForm({ email, callbackUrl }: { email: string; callbackUrl: string }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const valid = /^\d{6}$/.test(code);

  return (
    <form
      method="GET"
      action="/api/auth/callback/resend"
      onSubmit={() => setSubmitting(true)}
      className="mt-8 flex flex-col gap-4"
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label htmlFor="otp" className="sr-only">6-digit code</label>
      <input
        id="otp"
        name="token"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        autoFocus
        placeholder="••••••"
        className="h-16 w-full rounded-[2px] border border-border bg-surface text-center font-mono text-3xl tracking-[0.5em] text-fg placeholder:text-fg-subtle focus:border-gold focus:outline-none"
      />
      <Button type="submit" block disabled={!valid || !email} loading={submitting}>Verify & sign in</Button>
    </form>
  );
}
