import type { Metadata } from "next";
import { BadgeCheck, Gem, ShieldCheck, Undo2 } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";
import { ProductRail } from "@/components/home/product-rail";
import { DeliveryCheck } from "@/components/pdp/delivery-check";
import { Gallery } from "@/components/pdp/gallery";
import { PurchasePanel } from "@/components/pdp/purchase-panel";
import { ReviewsSection } from "@/components/pdp/reviews";
import { SizeGuide } from "@/components/pdp/size-guide";
import { SpecTable } from "@/components/pdp/spec-table";
import { ExternalRating, Stars } from "@/components/product/rating";
import { RecentlyViewed, TrackView } from "@/components/product/recently-viewed";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/misc";
import { getProductBySlug, getRelatedProducts } from "@/server/catalog/queries";
import { listReviews } from "@/server/reviews/queries";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

/** Rendered on first visit, then served from the ISR cache; admin edits & stock changes revalidate by tag. */
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/watches/[brand]/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return {};
  const title = p.seoTitle ?? `${p.brand.name} ${p.modelName} ${p.referenceNumber}`;
  const description = p.seoDescription ?? p.description.slice(0, 155);
  const url = `/watches/${p.brand.slug}/${p.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: p.isDemo ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function ProductPage({ params }: PageProps<"/watches/[brand]/[slug]">) {
  const { brand, slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  if (p.brand.slug !== brand) permanentRedirect(`/watches/${p.brand.slug}/${p.slug}`);

  const [related, reviews, settings] = await Promise.all([
    getRelatedProducts(p.id, p.brand.id, p.collections.map((c) => c.id), 8),
    listReviews(p.id, "helpful", 1),
    getSettings(),
  ]);
  const label = `${p.brand.name} ${p.modelName}`;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/watches/${p.brand.slug}/${p.slug}`;

  // Structured data from real data only — never for demo/sample products.
  const jsonLd = p.isDemo
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name: label,
        sku: p.sku,
        mpn: p.referenceNumber,
        brand: { "@type": "Brand", name: p.brand.name },
        description: p.description,
        image: p.images.map((i) => i.url),
        url,
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price: p.sellingPrice,
          availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          url,
        },
        ...(p.ratingCount > 0
          ? {
              aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.ratingCount, bestRating: 5, worstRating: 1 },
              review: reviews.items.filter((r) => !r.isDemo).slice(0, 5).map((r) => ({
                "@type": "Review",
                author: { "@type": "Person", name: r.authorName },
                datePublished: r.createdAt.slice(0, 10),
                name: r.title,
                reviewBody: r.body,
                reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
              })),
            }
          : {}),
      };

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
      <TrackView productId={p.id} />
      <div className="container-luxe pt-4 md:pt-8">
        <Breadcrumbs items={[
          { href: "/", label: "Home" },
          { href: "/watches", label: "Watches" },
          { href: `/watches/${p.brand.slug}`, label: p.brand.name },
          { label: p.modelName },
        ]} />
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="-mx-5 md:mx-0 lg:sticky lg:top-24 lg:self-start">
            <Gallery images={p.images} title={label} />
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {p.isDemo && <Badge tone="outline">Sample</Badge>}
                {p.collections.map((c) => <Badge key={c.id} tone="outline">{c.name}</Badge>)}
              </div>
              <a href={`/watches/${p.brand.slug}`} className="small-caps text-sm text-fg-muted hover:text-gold">{p.brand.name}</a>
              <h1 className="mt-1 text-4xl md:text-5xl">{p.modelName}</h1>
              <p className="mt-2 text-sm text-fg-subtle">Ref. {p.referenceNumber} · {p.caseDiameterMm} mm · {p.caseMaterial}</p>
              <div className="mt-3 flex flex-col gap-1.5">
                {p.ratingCount > 0 && (
                  <a href="#reviews" className="flex items-center gap-2 text-sm text-fg-muted hover:text-gold">
                    <Stars value={p.ratingAvg} /> <span>{p.ratingAvg.toFixed(1)} · {p.ratingCount} reviews</span>
                  </a>
                )}
                <ExternalRating rating={p.externalRating} count={p.externalRatingCount} source={p.externalRatingSource} />
              </div>
            </div>

            <PurchasePanel productId={p.id} label={label} mrp={p.mrp} price={p.sellingPrice} stock={p.stock} lowStockAt={p.lowStockAt} />
            <SizeGuide diameter={p.caseDiameterMm} lugWidth={p.lugWidthMm} />
            <DeliveryCheck />

            <ul className="grid grid-cols-2 gap-4 border-y border-border py-5 text-sm">
              <li className="flex items-start gap-2"><ShieldCheck className="size-5 shrink-0 text-gold" strokeWidth={1.25} aria-hidden /> Authenticity guaranteed</li>
              <li className="flex items-start gap-2"><Gem className="size-5 shrink-0 text-gold" strokeWidth={1.25} aria-hidden /> {p.boxAndPapers ? "Original box & papers" : "Presentation box"}</li>
              <li className="flex items-start gap-2"><BadgeCheck className="size-5 shrink-0 text-gold" strokeWidth={1.25} aria-hidden /> {p.warrantyMonths ? `${Math.round(p.warrantyMonths / 12)}-year warranty` : "Store warranty"}</li>
              <li className="flex items-start gap-2"><Undo2 className="size-5 shrink-0 text-gold" strokeWidth={1.25} aria-hidden /> {settings.returnWindowDays}-day returns</li>
            </ul>

            <div>
              <h2 className="mb-3 text-2xl">The watch</h2>
              <p className="leading-relaxed text-fg-muted">{p.description}</p>
            </div>
          </div>
        </div>

        <section className="mt-16 md:mt-24" aria-labelledby="specs-heading">
          <h2 id="specs-heading" className="mb-6 text-3xl md:text-4xl">Specifications</h2>
          <SpecTable p={p} />
        </section>

        {p.brand.story && (
          <section className="mt-16 grid gap-6 border border-border p-6 md:mt-24 md:grid-cols-[1fr_2fr] md:p-12" aria-label={`About ${p.brand.name}`}>
            <div>
              <p className="eyebrow text-gold">The Maison</p>
              <p className="mt-2 font-display text-3xl">{p.brand.name}</p>
              {p.brand.tagline && <p className="mt-1 text-sm text-fg-muted">{p.brand.tagline}</p>}
            </div>
            <p className="text-fg-muted">{p.brand.story}</p>
          </section>
        )}

        <div className="mt-16 md:mt-24">
          <ReviewsSection productId={p.id} avg={p.ratingAvg} count={p.ratingCount} dist={p.ratingDist} initial={reviews}
            writeHref={`/account/reviews/new?product=${p.id}`} />
        </div>

        {related.length > 0 && (
          <section className="mt-16 md:mt-24" aria-labelledby="related-heading">
            <h2 id="related-heading" className="mb-8 text-3xl md:text-4xl">You may also like</h2>
            <ProductRail products={related} />
          </section>
        )}
      </div>
      <RecentlyViewed excludeId={p.id} />
    </>
  );
}
