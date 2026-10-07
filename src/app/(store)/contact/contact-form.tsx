"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { sendContactMessage } from "@/server/actions/contact";

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, null);
  const e = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok) return <p role="status" className="border border-success/40 bg-success/10 p-4 text-success">{state.message}</p>;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <Field label="Name" error={e?.name} required>{(p) => <Input {...p} name="name" autoComplete="name" />}</Field>
      <Field label="Email" error={e?.email} required>{(p) => <Input {...p} name="email" type="email" autoComplete="email" />}</Field>
      <Field label="Phone (optional)" error={e?.phone}>{(p) => <Input {...p} name="phone" type="tel" inputMode="numeric" autoComplete="tel" />}</Field>
      <Field label="How can we help?" error={e?.message} required>{(p) => <Textarea {...p} name="message" rows={5} />}</Field>
      {state && !state.ok && !e && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" loading={pending} className="justify-self-start">Send message</Button>
    </form>
  );
}
