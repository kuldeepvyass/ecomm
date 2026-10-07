"use client";

import { MapPin, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AddressForm } from "@/components/account/address-form";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { stateName, type StateCode } from "@/lib/india";
import { deleteAddress } from "@/server/actions/addresses";

type Address = { id: string; label: string | null; fullName: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string; isDefault: boolean };

export function AddressesView({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  const [pending, start] = useTransition();
  const done = () => { setEditing(null); router.refresh(); };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Addresses</h2>
        {editing === null && <Button variant="outline" size="sm" onClick={() => setEditing("new")}><Plus aria-hidden /> Add address</Button>}
      </div>
      {editing === "new" && <div className="border border-border p-5"><AddressForm onSaved={done} onCancel={addresses.length ? () => setEditing(null) : undefined} /></div>}
      {addresses.length === 0 && editing !== "new" && <EmptyState icon={<MapPin />} title="No saved addresses" />}
      <ul className="grid gap-4 md:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className="border border-border p-5">
            {editing === a.id ? (
              <AddressForm initial={{ ...a, label: a.label ?? undefined, line2: a.line2 ?? undefined, landmark: a.landmark ?? undefined, state: a.state as StateCode }} onSaved={done} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <p className="font-medium">{a.fullName}</p>
                  {a.label && <Badge tone="outline">{a.label}</Badge>}
                  {a.isDefault && <Badge tone="gold">Default</Badge>}
                </div>
                <p className="text-sm text-fg-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ""}{a.landmark ? `, near ${a.landmark}` : ""}<br />{a.city}, {stateName(a.state)} {a.pincode}<br />+91 {a.phone}</p>
                <div className="mt-4 flex gap-4">
                  <Button variant="link" onClick={() => setEditing(a.id)}>Edit</Button>
                  <Button variant="link" className="text-danger" disabled={pending} onClick={() => start(async () => {
                    const res = await deleteAddress(a.id);
                    if (!res.ok) toast.error(res.error); else { toast.success("Address removed"); router.refresh(); }
                  })}>Remove</Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
