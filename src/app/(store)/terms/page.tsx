import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default async function Terms() {
  const s = await getSettings();
  return (
    <LegalPage title="Terms & Conditions" updated="1 October 2026">
      <p>These terms govern your use of this website and purchases from {s.storeName}, {s.addressLine}{s.gstin ? ` (GSTIN ${s.gstin})` : ""}. By placing an order you agree to them.</p>
      <h2>Eligibility & accounts</h2>
      <p>You must be 18 or older to buy. You&apos;re responsible for keeping access to your email account secure, since sign-in codes are sent there.</p>
      <h2>Products & pricing</h2>
      <p>All prices are in Indian Rupees and include GST. We make every effort to display products accurately; colours may vary slightly by screen. If a price or description is clearly wrong, we may cancel the order and refund you in full. Prices and availability can change without notice until your order is confirmed.</p>
      <h2>Orders & payment</h2>
      <p>We accept UPI payments made directly to our UPI ID (we don&apos;t offer Cash on Delivery). A UPI order is confirmed once we have verified your payment against the UTR you submit; until then the item is reserved for the time shown at checkout, after which an unpaid order is cancelled. Always pay the exact amount shown with the order note. We may decline or cancel orders in cases of suspected fraud, unavailable stock or delivery restrictions, with a full refund of any amount paid.</p>
      <h2>Delivery, returns & refunds</h2>
      <p>See our <a href="/shipping-policy">Shipping Policy</a> and <a href="/refund-policy">Returns, Refunds & Cancellations</a>.</p>
      <h2>Reviews</h2>
      <p>Only customers who have received a product can review it. Reviews must be honest and lawful; we may moderate or remove reviews that are abusive, off-topic or contain personal data.</p>
      <h2>Liability</h2>
      <p>To the extent permitted by law, our liability for any order is limited to the amount paid for it. Nothing here limits your rights under the Consumer Protection Act, 2019.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Courts at the location of our registered office shall have jurisdiction. Grievances: {s.contactEmail}.</p>
    </LegalPage>
  );
}
