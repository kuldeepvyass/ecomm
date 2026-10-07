"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updateProfile } from "@/server/actions/account";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  const errs = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid max-w-xl gap-4" noValidate>
      <Field label="Email">{(p) => <Input {...p} value={email} disabled readOnly />}</Field>
      <Field label="Full name" error={errs?.name} required>{(p) => <Input {...p} name="name" defaultValue={name} autoComplete="name" />}</Field>
      <Field label="Mobile number" error={errs?.phone} hint="Optional — used for delivery updates">
        {(p) => <Input {...p} name="phone" type="tel" inputMode="numeric" defaultValue={phone} autoComplete="tel-national" />}
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" loading={pending}>Save</Button>
        <p role="status" className={state?.ok ? "text-sm text-success" : "text-sm text-danger"}>{state ? (state.ok ? state.message : !errs ? state.error : "") : ""}</p>
      </div>
    </form>
  );
}
