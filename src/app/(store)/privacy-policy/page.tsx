import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function Privacy() {
  const s = await getSettings();
  return (
    <LegalPage title="Privacy Policy" updated="1 October 2026">
      <p>This policy explains how {s.storeName} (&quot;we&quot;) collects and uses your personal data when you use this website, in line with India&apos;s Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> your email address, name and mobile number.</li>
        <li><strong>Order data:</strong> delivery addresses, items purchased, invoices and order history.</li>
        <li><strong>Payment data:</strong> you pay us directly by UPI. We store the UPI transaction reference (UTR), the amount, and — if you choose to share them — your UPI ID and a payment screenshot, only to verify and refund payments. We never see your UPI PIN or bank login.</li>
        <li><strong>Usage data:</strong> pages viewed and products you look at (stored in your browser for &quot;recently viewed&quot;), and basic technical logs for security.</li>
      </ul>
      <h2>Why we use it</h2>
      <ul><li>To process and deliver orders, issue GST invoices, handle returns and refunds.</li><li>To send order updates (these are transactional and can&apos;t be switched off while an order is active).</li><li>With your consent, to send new-arrival and offer emails — you can opt out at any time in Account → Settings.</li><li>To prevent fraud and keep the service secure.</li></ul>
      <h2>Who we share it with</h2>
      <p>Only the service providers needed to run the store: courier partners (name, phone and address for delivery), email delivery provider, cloud hosting and image hosting. We never sell your data.</p>
      <h2>Cookies</h2>
      <p>We use essential cookies to keep you signed in and remember your bag. Optional analytics cookies are used only if you accept them in the cookie banner.</p>
      <h2>Retention & your rights</h2>
      <p>You can view and update your details at any time, and delete your account from Account → Settings. Invoices and order records are retained for the period required by Indian tax law, in anonymised form after account deletion. To exercise any right, or to contact our grievance officer, email <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>.</p>
    </LegalPage>
  );
}
