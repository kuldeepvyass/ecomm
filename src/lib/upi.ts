/**
 * Direct UPI payments (no gateway). We build a standard UPI payment URI (NPCI "upi://pay") with
 * the exact amount and the order number in the note; the customer's UPI app does the rest.
 * A website cannot read the result back from the UPI app, so the customer then submits the UTR,
 * which the store verifies against its bank/UPI statement.
 */

/** 12-digit UPI transaction reference (UTR / RRN). */
export const UTR_REGEX = /^\d{12}$/;

/** name@handle — handles are letters only (e.g. okhdfcbank, ybl, paytm, upi). */
export const VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/** Placeholder used only in development when no UPI ID is configured ("@bank" is not a real PSP handle). */
export const DEV_PLACEHOLDER_VPA = "your-upi-id@bank";

export function normalizeUtr(input: string): string {
  return input.replace(/\D/g, "");
}

export type UpiRequest = { vpa: string; payeeName: string; amount: number; orderNumber: string };

function params(r: UpiRequest) {
  return new URLSearchParams({
    pa: r.vpa,
    pn: r.payeeName.slice(0, 50),
    am: r.amount.toFixed(2),
    cu: "INR",
    tn: `Order ${r.orderNumber}`.slice(0, 50),
  }).toString();
}

/** Generic link: Android shows a chooser of installed UPI apps; also what the QR code encodes. */
export function upiUri(r: UpiRequest): string {
  return `upi://pay?${params(r)}`;
}

/** App-specific links (needed on iOS, where upi:// has no chooser). */
export function upiAppLinks(r: UpiRequest) {
  const q = params(r);
  return [
    { id: "gpay", label: "Google Pay", href: `tez://upi/pay?${q}` },
    { id: "phonepe", label: "PhonePe", href: `phonepe://pay?${q}` },
    { id: "paytm", label: "Paytm", href: `paytmmp://pay?${q}` },
    { id: "bhim", label: "Other UPI app", href: `upi://pay?${q}` },
  ] as const;
}

/** Where customers find the UTR in popular apps. */
export const UTR_HELP = [
  { app: "Google Pay", where: "Open the payment → “UPI transaction ID”" },
  { app: "PhonePe", where: "History → the payment → “UTR”" },
  { app: "Paytm", where: "Balance & History → the payment → “UPI Ref. No.”" },
  { app: "BHIM / bank apps", where: "Transactions → the payment → “UTR” or “RRN”" },
] as const;
