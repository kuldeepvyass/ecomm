"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { INDIAN_STATES } from "@/lib/india";
import { saveAddress, type AddressInput } from "@/server/actions/addresses";

type Initial = Partial<AddressInput> & { id?: string };

export function AddressForm({ initial, onSaved, onCancel, submitLabel = "Save address" }: {
  initial?: Initial;
  onSaved: (id: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    const input = {
      id: initial?.id,
      label: String(form.get("label") ?? ""),
      fullName: String(form.get("fullName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      line1: String(form.get("line1") ?? ""),
      line2: String(form.get("line2") ?? ""),
      landmark: String(form.get("landmark") ?? ""),
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? "") as AddressInput["state"],
      pincode: String(form.get("pincode") ?? ""),
      isDefault: form.get("isDefault") === "on",
    };
    start(async () => {
      const res = await saveAddress(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      toast.success("Address saved");
      onSaved(res.data.id);
    });
  }

  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2" noValidate data-testid="address-form">
      <Field label="Full name" error={errors.fullName} required className="sm:col-span-2">
        {(p) => <Input {...p} name="fullName" autoComplete="name" defaultValue={initial?.fullName} required />}
      </Field>
      <Field label="Mobile number" error={errors.phone} required hint="For delivery updates and the courier">
        {(p) => <Input {...p} name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} defaultValue={initial?.phone} placeholder="98765 43210" required />}
      </Field>
      <Field label="PIN code" error={errors.pincode} required>
        {(p) => <Input {...p} name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} pattern="[1-9][0-9]{5}" defaultValue={initial?.pincode} required />}
      </Field>
      <Field label="Flat, house no., building, street" error={errors.line1} required className="sm:col-span-2">
        {(p) => <Input {...p} name="line1" autoComplete="address-line1" defaultValue={initial?.line1} required />}
      </Field>
      <Field label="Area, locality (optional)" error={errors.line2} className="sm:col-span-2">
        {(p) => <Input {...p} name="line2" autoComplete="address-line2" defaultValue={initial?.line2} />}
      </Field>
      <Field label="Landmark (optional)" error={errors.landmark}>
        {(p) => <Input {...p} name="landmark" defaultValue={initial?.landmark} />}
      </Field>
      <Field label="City" error={errors.city} required>
        {(p) => <Input {...p} name="city" autoComplete="address-level2" defaultValue={initial?.city} required />}
      </Field>
      <Field label="State" error={errors.state} required className="sm:col-span-2">
        {(p) => (
          <Select {...p} name="state" autoComplete="address-level1" defaultValue={initial?.state ?? ""} required>
            <option value="" disabled>Select state</option>
            {INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Save as (optional)" error={errors.label}>
        {(p) => <Input {...p} name="label" placeholder="Home, Office…" defaultValue={initial?.label} maxLength={30} />}
      </Field>
      <div className="flex items-end">
        <Checkbox name="isDefault" label="Make this my default address" defaultChecked={initial?.isDefault} />
      </div>
      <div className="flex gap-3 sm:col-span-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={pending} className="flex-1 sm:flex-none">{submitLabel}</Button>
      </div>
    </form>
  );
}
