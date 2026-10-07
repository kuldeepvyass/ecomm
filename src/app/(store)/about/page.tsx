import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Our Story", description: "A boutique of fine timepieces, curated and authenticated in India." };

export default async function About() {
  const s = await getSettings();
  return (
    <LegalPage title="Our Story" eyebrow="The Maison">
      <p>{s.storeName} was founded on a simple belief: a fine watch should be bought with the same care with which it was made. We are a boutique, not a marketplace — every piece we offer is selected by our specialists, inspected in our atelier and delivered to you fully insured.</p>
      <h2>What we stand for</h2>
      <ul>
        <li><strong>Authenticity, guaranteed.</strong> Every watch is verified before it ships and comes with its box, papers and warranty card.</li>
        <li><strong>Honest pricing.</strong> Prices are shown in rupees, inclusive of GST. No hidden charges at checkout.</li>
        <li><strong>Service for life.</strong> From sizing your bracelet to arranging servicing, our client services team is a message away.</li>
      </ul>
      <h2>Visit or write to us</h2>
      <p>{s.addressLine}<br />{s.contactEmail} · {s.contactPhone}</p>
    </LegalPage>
  );
}
