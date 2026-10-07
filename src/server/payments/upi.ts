import "server-only";
import QRCode from "qrcode";
import { DEV_PLACEHOLDER_VPA, upiUri, type UpiRequest } from "@/lib/upi";
import type { StoreConfig } from "@/server/settings";

export type UpiConfig = { vpa: string; payeeName: string; placeholder: boolean };

/**
 * The store's UPI ID from Admin → Settings. In development, if none is set, a placeholder
 * ("@bank" is not a real UPI handle, so no money can go astray) lets the payment page be previewed.
 * In production, UPI checkout stays off until a real UPI ID is configured.
 */
export function effectiveUpi(s: Pick<StoreConfig, "upiVpa" | "upiPayeeName" | "storeName">): UpiConfig | null {
  if (s.upiVpa) return { vpa: s.upiVpa, payeeName: s.upiPayeeName || s.storeName, placeholder: false };
  if (process.env.NODE_ENV !== "production" || process.env.E2E_TEST_MODE === "1") {
    return { vpa: DEV_PLACEHOLDER_VPA, payeeName: s.upiPayeeName || s.storeName, placeholder: true };
  }
  return null;
}

/** QR code (SVG markup) encoding the UPI intent — scannable by every UPI app. */
export async function upiQrSvg(req: UpiRequest): Promise<string> {
  return QRCode.toString(upiUri(req), { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0b0a09", light: "#ffffff" } });
}
