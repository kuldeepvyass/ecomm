import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Returns, Refunds & Cancellations", description: "How cancellations, returns, exchanges and refunds work." };

export default async function Refunds() {
  const s = await getSettings();
  return (
    <LegalPage title="Returns, Refunds & Cancellations" eyebrow="Client services" updated="1 October 2026">
      <h2>Cancellations</h2>
      <p>You can cancel an order from <strong>My Account → Orders</strong> at any time before it ships. Online payments are refunded in full to the original payment method automatically. Once an order has shipped it can no longer be cancelled, but you may return it after delivery.</p>
      <h2>Returns & exchanges</h2>
      <p>You may request a return or exchange within <strong>{s.returnWindowDays} days of delivery</strong> from your order page. To be eligible the watch must be unworn and in its original condition, with all protective films, tags, the box, papers, warranty card and accessories. Bracelets that have been resized can be returned only with all removed links.</p>
      <p>We arrange an insured pickup at no cost to you. Items are inspected on arrival; if a return does not meet these conditions we will ship it back to you.</p>
      <h3>Not eligible</h3>
      <ul><li>Watches that have been worn, scratched, engraved or altered.</li><li>Limited editions marked as final sale on the product page.</li></ul>
      <h2>Refunds</h2>
      <p>Approved refunds are issued within 2 business days of the return passing inspection, to the UPI account you paid from — we email you the refund reference. UPI refunds usually arrive within minutes.</p>
      <h2>Damaged or incorrect items</h2>
      <p>If your watch arrives damaged or isn&apos;t what you ordered, contact us within 48 hours of delivery with photos and we&apos;ll arrange a replacement or full refund.</p>
      <p>Contact: {s.contactEmail} · {s.contactPhone}</p>
    </LegalPage>
  );
}
