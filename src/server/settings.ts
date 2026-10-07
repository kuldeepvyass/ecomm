import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache-tags";

export type StoreConfig = {
  storeName: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string | null;
  addressLine: string;
  gstin: string | null;
  stateCode: string;
  globalDiscountPct: number;
  returnWindowDays: number;
  shippingFee: number;
  freeShippingThreshold: number | null;
  defaultDeliveryDays: number;
  expressShippingFee: number | null;
  upiVpa: string | null;
  upiPayeeName: string | null;
  paymentWindowMinutes: number;
};

export const DEFAULT_SETTINGS: StoreConfig = {
  storeName: "Maison Horlogère",
  logoUrl: null,
  contactEmail: "concierge@maisonhorlogere.in",
  contactPhone: "+91 00000 00000",
  whatsappNumber: null,
  addressLine: "Address to be configured in Admin → Settings",
  gstin: null,
  stateCode: "MH",
  globalDiscountPct: 0,
  returnWindowDays: 7,
  shippingFee: 0,
  freeShippingThreshold: null,
  defaultDeliveryDays: 5,
  expressShippingFee: 1500,
  upiVpa: null,
  upiPayeeName: null,
  paymentWindowMinutes: 30,
};

/** Uncached read — use inside transactions / anything that charges money. */
export async function readSettings(): Promise<StoreConfig> {
  const s = await db.storeSettings.findUnique({ where: { id: 1 } });
  if (!s) return DEFAULT_SETTINGS;
  return { ...s, globalDiscountPct: Number(s.globalDiscountPct) };
}

export const getSettings = unstable_cache(readSettings, ["store-settings"], { tags: [TAGS.settings] });
