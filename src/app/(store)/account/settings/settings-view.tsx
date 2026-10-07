"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { deleteMyAccount, updateNotificationPrefs } from "@/server/actions/account";

export function SettingsView({ prefs }: { prefs: { notifyMarketing: boolean; notifyBackInStock: boolean } }) {
  const [p, setP] = useState(prefs);
  const [saving, start] = useTransition();
  const [delState, delAction, deleting] = useActionState(deleteMyAccount, null);
  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="notif-heading">
        <h2 id="notif-heading" className="mb-2 text-3xl">Notifications</h2>
        <p className="mb-4 text-sm text-fg-muted">Order confirmations, shipping updates and refunds are always sent — they&apos;re part of your purchase.</p>
        <Checkbox label="New arrivals, private previews and offers" checked={p.notifyMarketing} onChange={(e) => setP({ ...p, notifyMarketing: e.target.checked })} />
        <Checkbox label="Back-in-stock alerts for watches I've asked about" checked={p.notifyBackInStock} onChange={(e) => setP({ ...p, notifyBackInStock: e.target.checked })} />
        <Button className="mt-4" loading={saving} onClick={() => start(async () => {
          const r = await updateNotificationPrefs(p);
          if (r.ok) toast.success("Preferences saved"); else toast.error(r.error);
        })}>Save preferences</Button>
      </section>
      <section aria-labelledby="delete-heading" className="border border-danger/40 p-5">
        <h2 id="delete-heading" className="mb-2 text-3xl">Delete account</h2>
        <p className="mb-4 text-sm text-fg-muted">This permanently removes your profile, addresses, wishlist and bag. Order and invoice records are kept in anonymised form as required by Indian tax law.</p>
        <form action={delAction} className="flex max-w-md flex-col gap-3">
          <Field label='Type "DELETE" to confirm' error={delState && !delState.ok ? delState.error : undefined}>
            {(fp) => <Input {...fp} name="confirm" autoComplete="off" />}
          </Field>
          <Button type="submit" variant="danger" loading={deleting} className="self-start">Delete my account</Button>
        </form>
      </section>
    </div>
  );
}
