import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Hero } from "@/components/home/hero";
import { ProductRail } from "@/components/home/product-rail";
import { Reveal } from "@/components/home/reveal";
import { TRUST_BADGES } from "@/components/layout/site-footer";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { WatchImage } from "@/components/product/watch-image";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/misc";
import { getBrands, getCollections, getFeaturedProducts, getNewArrivals } from "@/server/catalog/queries";
import { getBanners } from "@/server/content";
import { OrganizationJsonLd } from "./organization-jsonld";

export default async function HomePage() {
  const [heroes, stories, shopBy, collections, featured, arrivals, brands] = await Promise.all([
    getBanners("HERO"),
    getBanners("STORY"),
    getBanners("SHOP_BY"),
    getCollections(),
    getFeaturedProducts(8),
    getNewArrivals(8),
    getBrands(),
  ]);
  const hero = heroes[0];
  const story = stories[0];
  // Never show an empty collection on the homepage.
  const homeCollections = collections.filter((c) => c.showOnHome && c._count.products > 0);
  const tiles = shopBy.length
    ? shopBy.map((b) => ({ href: b.ctaHref ?? "/watches", title: b.title, body: b.subtitle ?? "", cta: b.ctaLabel ?? "Shop now", image: b.imageUrl }))
    : [
        { href: "/watches?gender=MEN", title: "For Him", body: "Automatics, chronographs and everyday icons.", cta: "Shop now", image: undefined },
        { href: "/watches?gender=WOMEN", title: "For Her", body: "Jewellery watches and everyday icons.", cta: "Shop now", image: undefined },
      ];

  return (
    <>
      <OrganizationJsonLd />
      {hero ? (
        <Hero banner={hero} />
      ) : (
        <section className="container-luxe py-24 text-center">
          <h1 className="text-6xl">Time, Mastered.</h1>
        </section>
      )}

      {/* Trust badges */}
      <section aria-label="Our promise" className="border-y border-border bg-surface">
        <ul className="container-luxe grid grid-cols-2 gap-x-4 gap-y-6 py-8 md:grid-cols-4 md:py-10">
          {TRUST_BADGES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col items-start gap-2 md:flex-row md:gap-4">
              <Icon className="size-6 shrink-0 text-gold" strokeWidth={1.25} aria-hidden />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-xs text-fg-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Curated collections */}
      {homeCollections.length > 0 && (
        <section className="container-luxe py-16 md:py-28" aria-labelledby="collections-heading">
          <Reveal>
            <SectionHeading eyebrow="Curated Collections" title="Find your signature" description={`${["One way", "Two ways", "Three ways", "Four ways"][Math.min(homeCollections.length, 4) - 1]} into the world of fine watchmaking.`} />
          </Reveal>
          <ul className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
            {homeCollections.map((c, i) => (
              <li key={c.id}>
                <Reveal delay={i * 0.06}>
                  <Link href={`/collections/${c.slug}`} className="group relative block aspect-[3/4] overflow-hidden bg-surface-2">
                    {c.heroImage && (
                      <WatchImage src={c.heroImage} alt="" fill sizes="(min-width: 1024px) 24vw, 48vw" linkedFit="cover"
                        className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-luxe)] group-hover:scale-105" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" aria-hidden />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-[#f5f1ea] md:p-6">
                      <h3 className="text-2xl md:text-3xl">{c.name}</h3>
                      <p className="mt-1 text-xs text-[#d8d2c8]">{c._count.products} {c._count.products === 1 ? "piece" : "pieces"}</p>
                    </div>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <section className="container-luxe pb-16 md:pb-28" aria-labelledby="featured-heading">
          <Reveal>
            <SectionHeading eyebrow="The Edit" title="Chosen by our specialists"
              action={<Button asChild variant="link"><Link href="/watches?sort=popular">View all <ArrowRight aria-hidden /></Link></Button>} />
          </Reveal>
          <ProductRail products={featured} />
        </section>
      )}

      {/* Brand story strip */}
      {story && (
        <section className="bg-surface" aria-labelledby="story-heading">
          <div className="grid md:grid-cols-2">
            <div className="relative aspect-[4/5] md:aspect-auto md:min-h-[640px]">
              <WatchImage src={story.imageUrl} alt="Hand-finished watch movement" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="flex items-center px-5 py-16 md:px-16 lg:px-24">
              <Reveal className="max-w-lg">
                {story.eyebrow && <p className="eyebrow mb-4 text-gold">{story.eyebrow}</p>}
                <h2 id="story-heading" className="text-4xl md:text-6xl">{story.title}</h2>
                <div className="gold-rule my-8 w-24" />
                {story.subtitle && <p className="text-lg text-fg-muted">{story.subtitle}</p>}
                {story.ctaHref && (
                  <Button asChild variant="outline" className="mt-10">
                    <Link href={story.ctaHref}>{story.ctaLabel ?? "Discover"} <ArrowRight aria-hidden /></Link>
                  </Button>
                )}
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* Shop by */}
      <section className="container-luxe grid gap-3 py-16 md:grid-cols-2 md:gap-6 md:py-28" aria-label="Shop by">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="group relative flex aspect-[16/10] items-end overflow-hidden bg-surface-2 p-6 md:p-10">
            {t.image && <WatchImage src={t.image} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" linkedFit="cover"
              className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-luxe)] group-hover:scale-105" />}
            {/* Strong scrim: tiles can use bright studio shots (silver/white dials) behind white text. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/10" aria-hidden />
            <div className="relative text-[#f5f1ea]">
              <h2 className="text-4xl md:text-5xl">{t.title}</h2>
              <p className="mt-2 text-sm text-[#d8d2c8]">{t.body}</p>
              <span className="eyebrow mt-4 inline-flex items-center gap-2 text-[#dcc08c]">{t.cta} <ArrowRight className="size-4" aria-hidden /></span>
            </div>
          </Link>
        ))}
      </section>

      {/* New arrivals */}
      {arrivals.length > 0 && (
        <section className="container-luxe" aria-labelledby="arrivals-heading">
          <Reveal>
            <SectionHeading eyebrow="Just arrived" title="New to the boutique"
              action={<Button asChild variant="link"><Link href="/watches?sort=newest">Shop new arrivals <ArrowRight aria-hidden /></Link></Button>} />
          </Reveal>
          <ProductRail products={arrivals} />
        </section>
      )}

      <RecentlyViewed />

      {/* Maisons */}
      {brands.length > 0 && (
        <section className="border-t border-border" aria-labelledby="maisons-heading">
          <div className="container-luxe py-16 md:py-24">
            <p id="maisons-heading" className="eyebrow mb-8 text-center text-fg-muted">Our Maisons</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 md:gap-x-16">
              {brands.filter((b) => b._count.products > 0).map((b) => (
                <li key={b.id}>
                  <Link href={`/watches/${b.slug}`} className="flex min-h-11 items-center font-display text-2xl text-fg-muted transition-colors hover:text-gold md:text-3xl">
                    {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
