"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestEmailSignIn, signInWithGoogle } from "@/server/actions/auth";

export function SignInForm({ callbackUrl, googleEnabled }: { callbackUrl: string; googleEnabled: boolean }) {
  const [state, action, pending] = useActionState(requestEmailSignIn, null);
  const err = state && !state.ok ? state : null;
  return (
    <div className="mt-10 flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Field label="Email address" error={err?.fieldErrors?.email ?? (err && !err.fieldErrors ? err.error : undefined)} required>
          {(p) => <Input {...p} name="email" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" />}
        </Field>
        <Button type="submit" block loading={pending}>Continue with email</Button>
        <p className="text-center text-xs text-fg-subtle">We&apos;ll email you a 6-digit code and a one-tap sign-in link.</p>
      </form>
      {googleEnabled && (
        <>
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-fg-subtle">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <form action={signInWithGoogle}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Button type="submit" variant="outline" block>
              <svg viewBox="0 0 24 24" aria-hidden className="size-4"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"/></svg>
              Continue with Google
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
