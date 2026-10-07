"use client";

import { MapPin, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Est = { ok: true; serviceable: boolean; label: string; from: string; to: string } | { ok: false; error: string };
const KEY = "mh:pin";

export function DeliveryCheck() {
  const [pin, setPin] = useState("");
  const [est, setEst] = useState<Est | null>(null);
  const [loading, setLoading] = useState(false);

  async function check(value = pin) {
    if (!/^[1-9]\d{5}$/.test(value)) {
      setEst({ ok: false, error: "Enter a valid 6-digit PIN code." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery?pin=${value}`);
      setEst(await res.json());
      try { localStorage.setItem(KEY, value); } catch {}
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore remembered PIN
        setPin(saved);
        void check(saved);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="border border-border p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium"><Truck className="size-4 text-gold" aria-hidden /> Delivery</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(); }} className="flex gap-2">
        <label htmlFor="pin" className="sr-only">PIN code</label>
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="postal-code"
            placeholder="Enter PIN code" maxLength={6} aria-describedby="pin-result"
            className="h-11 w-full rounded-[2px] border border-border bg-surface pl-9 pr-3 text-sm focus:border-gold focus:outline-none" />
        </div>
        <Button type="submit" variant="outline" size="sm" className="h-11" loading={loading}>Check</Button>
      </form>
      <div id="pin-result" aria-live="polite" className="mt-3 text-sm">
        {est && !est.ok && <p className="text-danger">{est.error}</p>}
        {est?.ok && !est.serviceable && <p className="text-danger">Sorry, we don&apos;t deliver to this PIN code yet.</p>}
        {est?.ok && est.serviceable && (
          <div className="space-y-1">
            <p>Delivered by <strong className="font-medium">{est.from} – {est.to}</strong> <span className="text-fg-muted">({est.label})</span></p>
            <p className="text-fg-muted">Fully insured shipping · Signature on delivery</p>
          </div>
        )}
      </div>
    </div>
  );
}
