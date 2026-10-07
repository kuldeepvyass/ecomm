import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Authenticity Guarantee", description: "Every watch is verified genuine, with box, papers and warranty." };

export default async function Authenticity() {
  const s = await getSettings();
  return (
    <LegalPage title="Authenticity Guarantee" eyebrow="Our promise" updated="1 October 2026">
      <p>Every watch sold by {s.storeName} is <strong>100% genuine</strong>. We source only from authorised distributors and verified partners, and every piece is inspected by our specialists before dispatch.</p>
      <h2>How we verify</h2>
      <ul>
        <li>Serial and reference numbers checked against the manufacturer&apos;s records and the accompanying papers.</li>
        <li>Case, dial, hands, crown and bracelet inspected under magnification for finishing consistent with the maker.</li>
        <li>Movement timed and, where an exhibition caseback allows, visually verified.</li>
        <li>Box, papers, warranty card and accessories checked for completeness.</li>
      </ul>
      <h2>Our guarantee</h2>
      <p>If any watch purchased from us is ever shown not to be genuine by the manufacturer or an authorised service centre, we will refund the <strong>full purchase price</strong>, including shipping, with no time limit.</p>
      <h2>Warranty</h2>
      <p>Watches carry the manufacturer&apos;s international warranty for the period shown on each product page. We help you register and claim it.</p>
      <p>Questions? Write to <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>.</p>
    </LegalPage>
  );
}
