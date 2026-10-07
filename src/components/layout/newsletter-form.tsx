"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { subscribeNewsletter } from "@/server/actions/newsletter";

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <label htmlFor="newsletter-email" className="sr-only">Email address</label>
      <div className="flex gap-2">
        <input id="newsletter-email" name="email" type="email" required autoComplete="email" placeholder="Your email address"
          aria-invalid={state && !state.ok ? true : undefined} aria-describedby="newsletter-msg"
          className="h-12 min-w-0 flex-1 rounded-[2px] border border-border bg-surface px-4 text-fg placeholder:text-fg-subtle focus:border-gold focus:outline-none" />
        <Button type="submit" loading={pending} size="md">Join</Button>
      </div>
      <p id="newsletter-msg" role="status" className={state ? (state.ok ? "text-sm text-success" : "text-sm text-danger") : "sr-only"}>
        {state ? (state.ok ? state.message : (state.fieldErrors?.email?.[0] ?? state.error)) : ""}
      </p>
    </form>
  );
}
