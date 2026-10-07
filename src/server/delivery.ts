import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { PIN_REGEX } from "@/lib/india";

const getZones = unstable_cache(async () => db.shippingZone.findMany(), ["zones"], { tags: ["zones"], revalidate: 3600 });

export type DeliveryEstimate =
  | { ok: true; serviceable: boolean; label: string; minDays: number; maxDays: number; from: string; to: string }
  | { ok: false; error: string };

function addBusinessDays(start: Date, days: number) {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added++; // no Sunday deliveries
  }
  return d;
}

/** Longest matching PIN prefix wins; falls back to the store default. */
export async function estimateDelivery(pin: string, defaultDays = 5, now = new Date()): Promise<DeliveryEstimate> {
  if (!PIN_REGEX.test(pin)) return { ok: false, error: "Enter a valid 6-digit PIN code." };
  const zones = await getZones();
  const zone = zones.filter((z) => pin.startsWith(z.pinPrefix)).sort((a, b) => b.pinPrefix.length - a.pinPrefix.length)[0];
  const minDays = zone?.minDays ?? defaultDays - 1;
  const maxDays = zone?.maxDays ?? defaultDays + 1;
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  return {
    ok: true,
    serviceable: zone?.serviceable ?? true,
    label: zone?.label ?? "India",
    minDays,
    maxDays,
    from: fmt(addBusinessDays(now, minDays)),
    to: fmt(addBusinessDays(now, maxDays)),
  };
}
