import { getSettings } from "@/server/settings";

/** Organization + WebSite (sitelinks search box) structured data from real store settings. */
export async function OrganizationJsonLd() {
  const s = await getSettings();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
  const data = [
    { "@context": "https://schema.org", "@type": "Organization", name: s.storeName, url: base, logo: `${base}/icons/icon-512.png`, email: s.contactEmail, telephone: s.contactPhone },
    { "@context": "https://schema.org", "@type": "WebSite", name: s.storeName, url: base, potentialAction: { "@type": "SearchAction", target: `${base}/search?q={search_term_string}`, "query-input": "required name=search_term_string" } },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
