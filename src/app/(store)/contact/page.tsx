import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { LegalPage } from "@/components/legal/legal-page";
import { getSettings } from "@/server/settings";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact", description: "Client services — email, phone and WhatsApp." };

export default async function Contact() {
  const s = await getSettings();
  return (
    <LegalPage title="Contact us" eyebrow="Client services">
      <div className="not-prose grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <ul className="flex flex-col gap-5 text-fg">
          <li className="flex gap-3"><Mail className="mt-0.5 size-5 text-gold" aria-hidden /><a href={`mailto:${s.contactEmail}`} className="hover:text-gold">{s.contactEmail}</a></li>
          <li className="flex gap-3"><Phone className="mt-0.5 size-5 text-gold" aria-hidden /><a href={`tel:${s.contactPhone.replace(/\s/g, "")}`} className="hover:text-gold">{s.contactPhone}</a></li>
          {s.whatsappNumber && <li className="flex gap-3"><MessageCircle className="mt-0.5 size-5 text-gold" aria-hidden /><a href={`https://wa.me/${s.whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-gold">WhatsApp a specialist</a></li>}
          <li className="flex gap-3"><MapPin className="mt-0.5 size-5 text-gold" aria-hidden /><span>{s.addressLine}</span></li>
          <li className="text-sm text-fg-muted">Monday – Saturday, 10:00 – 19:00 IST</li>
        </ul>
        <ContactForm />
      </div>
    </LegalPage>
  );
}
