import { Lock, ShieldCheck, Truck, Undo2 } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { getSettings } from "@/server/settings";
import { LEGAL_LINKS, PRIMARY_NAV, SERVICE_LINKS } from "./nav-links";
import { NewsletterForm } from "./newsletter-form";

export const TRUST_BADGES = [
  { icon: ShieldCheck, title: "Authenticity guaranteed", body: "Every watch verified, with box & papers." },
  { icon: Truck, title: "Insured shipping", body: "Fully insured, signature on delivery." },
  { icon: Undo2, title: "Easy returns", body: "Hassle-free returns within the return window." },
  { icon: Lock, title: "Direct UPI payments", body: "No payment fees — every payment verified by our team." },
] as const;

export async function SiteFooter() {
  const s = await getSettings();
  return (
    <footer className="mt-24 border-t border-border bg-surface pb-24 md:pb-0">
      <div className="container-luxe grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
        <div className="flex flex-col gap-5">
          <Wordmark />
          <p className="max-w-xs text-sm text-fg-muted">
            A boutique of fine timepieces — curated, authenticated and delivered with care across India.
          </p>
          <address className="text-sm not-italic text-fg-muted">
            {s.addressLine}
            <br />
            <a href={`mailto:${s.contactEmail}`} className="hover:text-gold">{s.contactEmail}</a>
            <br />
            <a href={`tel:${s.contactPhone.replace(/\s/g, "")}`} className="hover:text-gold">{s.contactPhone}</a>
          </address>
        </div>
        <nav aria-label="Shop">
          <p className="eyebrow mb-4 text-gold">Shop</p>
          <ul className="flex flex-col">
            {PRIMARY_NAV.map((l) => (
              <li key={l.href}><Link href={l.href} className="flex min-h-11 items-center text-sm text-fg-muted hover:text-fg">{l.label}</Link></li>
            ))}
            <li><Link href="/compare" className="flex min-h-11 items-center text-sm text-fg-muted hover:text-fg">Compare</Link></li>
          </ul>
        </nav>
        <nav aria-label="Client services">
          <p className="eyebrow mb-4 text-gold">Client Services</p>
          <ul className="flex flex-col">
            {SERVICE_LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className="flex min-h-11 items-center text-sm text-fg-muted hover:text-fg">{l.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="eyebrow mb-4 text-gold">The Private List</p>
          <p className="mb-4 text-sm text-fg-muted">New arrivals, limited editions and private previews — first.</p>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-luxe flex flex-col gap-3 py-6 text-xs text-fg-subtle md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {s.storeName}. All prices in INR, inclusive of GST.</p>
          <ul className="flex flex-wrap gap-x-6">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className="flex min-h-11 items-center hover:text-fg">{l.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
