import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { formatINR } from "@/lib/money";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Shipping Policy", description: "Insured delivery across India, with tracking and signature on delivery." };

export default async function Shipping() {
  const s = await getSettings();
  return (
    <LegalPage title="Shipping Policy" eyebrow="Client services" updated="1 October 2026">
      <h2>Where we deliver</h2>
      <p>We ship to serviceable PIN codes across India. Enter your PIN on any product page to see the expected delivery date. We currently don&apos;t ship internationally or to APO/FPO addresses.</p>
      <h2>Charges</h2>
      <ul>
        <li>Standard insured delivery: {s.shippingFee === 0 ? "free" : formatINR(s.shippingFee)}{s.freeShippingThreshold ? `; free on orders above ${formatINR(s.freeShippingThreshold)}` : ""}.</li>
        {s.expressShippingFee !== null && <li>Express insured delivery (priority dispatch within 24 hours): {formatINR(s.expressShippingFee)}.</li>}
      </ul>
      <h2>Dispatch & delivery times</h2>
      <p>Orders are dispatched within 1–2 business days of payment confirmation. Typical delivery is {s.defaultDeliveryDays - 1}–{s.defaultDeliveryDays + 1} business days depending on your location. You&apos;ll receive an email with the courier and tracking number when your order ships, and updates when it&apos;s out for delivery and delivered.</p>
      <h2>Insurance & signature</h2>
      <p>Every parcel is fully insured until it is in your hands and requires a signature on delivery. Please check that the outer packaging and tamper-evident seal are intact before accepting. If anything looks wrong, refuse the parcel and contact us immediately.</p>
      <h2>Contact</h2>
      <p>{s.contactEmail} · {s.contactPhone}</p>
    </LegalPage>
  );
}
