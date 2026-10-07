import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { LegalPage } from "@/components/legal/legal-page";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "FAQ", description: "Answers about authenticity, delivery, payment, EMI, returns and warranty." };

export default async function FAQ() {
  const s = await getSettings();
  const qa: [string, string][] = [
    ["Are your watches genuine?", "Yes. Every watch is verified by our specialists and comes with its box, papers and warranty. If a watch is ever shown not to be genuine, we refund the full price — see our Authenticity Guarantee."],
    ["Are prices inclusive of GST?", "Yes. Every price on the site includes GST, and you'll receive a GST invoice with your order."],
    ["How do I pay?", `By UPI — Google Pay, PhonePe, Paytm, BHIM or your bank's app. Scan the QR code or tap your app at checkout, then enter the 12-digit UTR so we can match your payment. There are no payment fees.`],
    ["How long does payment verification take?", "Our team checks every UPI payment against the bank statement, usually within a few hours during business hours (Mon–Sat, 10:00–19:00 IST). Your watch is reserved meanwhile, and you'll get an email the moment it's confirmed."],
    ["Where do I find my UTR?", "In your UPI app, open the payment: Google Pay calls it “UPI transaction ID”, PhonePe “UTR”, Paytm “UPI Ref. No.” and bank apps “UTR” or “RRN”. It's always 12 digits."],
    ["Can I pay by card or EMI?", "Not at the moment — to keep our prices low we accept UPI only, which has no transaction fees. We don't offer Cash on Delivery."],
    ["How long does delivery take?", "Enter your PIN code on any product page for an estimate. Most orders arrive in 2–6 business days, fully insured and with signature on delivery."],
    ["Can I cancel my order?", "Yes, from My Account → Orders at any time before it ships. Online payments are refunded automatically."],
    ["What is your return policy?", `Unworn watches with all packaging and papers can be returned or exchanged within ${s.returnWindowDays} days of delivery. We arrange the insured pickup.`],
    ["Will my bracelet fit?", "Use the size guide on each product page. If your bracelet needs adjusting, our team can size it before dispatch — mention your wrist size when you order, or write to us."],
    ["How do I track my order?", "You'll receive an email with the courier and tracking link when your order ships. The live status timeline is always in My Account → Orders."],
  ];
  return (
    <LegalPage title="Frequently Asked Questions" eyebrow="Client services">
      <div className="not-prose divide-y divide-border border-y border-border">
        {qa.map(([q, a]) => (
          <details key={q} className="group py-2">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-fg">
              <span className="text-base font-medium">{q}</span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="pb-4 pr-8">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8">Still have a question? <a href="/contact">Contact client services</a>.</p>
    </LegalPage>
  );
}
