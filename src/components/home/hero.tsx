"use client";

import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { getImageProps } from "next/image";
import { sameOriginLoader } from "@/lib/image-loader";

type Banner = {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

/** Full-bleed cinematic hero: slow drift + parallax on a still (LCP-friendly), optional muted video. */
export function Hero({ banner }: { banner: Banner }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "18%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, reduce ? 1 : 0]);

  return (
    <section ref={ref} className="relative -mt-16 h-[100svh] min-h-[560px] overflow-hidden bg-bg md:-mt-20" aria-label="Featured">
      <m.div style={{ y }} className="absolute inset-0 will-change-transform">
        <div className="absolute inset-0 animate-[hero-drift_24s_ease-in-out_infinite_alternate] motion-reduce:animate-none">
          <HeroPicture desktop={banner.imageUrl} mobile={banner.mobileImageUrl ?? banner.imageUrl} />
          {banner.videoUrl && !reduce && (
            <video className="absolute inset-0 hidden h-full w-full object-cover md:block" src={banner.videoUrl} autoPlay muted loop playsInline preload="none" aria-hidden />
          )}
        </div>
      </m.div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(11_10_9/0.55)_0%,rgb(11_10_9/0.1)_35%,rgb(11_10_9/0.75)_80%,rgb(11_10_9/0.95)_100%)]" aria-hidden />
      <m.div style={{ opacity: fade }} className="container-luxe relative flex h-full flex-col justify-end pb-28 md:pb-24">
        <div className="max-w-2xl text-[#f5f1ea]">
          {banner.eyebrow && (
            <p className="animate-[fade-up_0.6s_var(--ease-luxe)_0.1s_both] eyebrow mb-4 text-[#dcc08c]">
              {banner.eyebrow}
            </p>
          )}
          <h1 className="animate-[fade-up_0.8s_var(--ease-luxe)_0.15s_both] text-5xl leading-[0.95] sm:text-6xl md:text-7xl lg:text-8xl">
            {banner.title}
          </h1>
          {banner.subtitle && (
            <p className="animate-[fade-up_0.7s_var(--ease-luxe)_0.35s_both] mt-5 max-w-lg text-base text-[#d8d2c8] md:text-lg">
              {banner.subtitle}
            </p>
          )}
          {banner.ctaHref && (
            <div className="animate-[fade-up_0.6s_var(--ease-luxe)_0.5s_both] mt-8">
              <Button asChild size="lg" className="bg-[#c9a96e] text-[#0b0a09] hover:bg-[#dcc08c]">
                <Link href={banner.ctaHref}>{banner.ctaLabel ?? "Discover"} <ArrowRight aria-hidden /></Link>
              </Button>
            </div>
          )}
        </div>
      </m.div>
    </section>
  );
}

/** One <img> with art direction (portrait on phones, wide on desktop) so only one file downloads. */
function HeroPicture({ desktop, mobile }: { desktop: string; mobile: string }) {
  const common = { alt: "", sizes: "100vw", loader: sameOriginLoader, quality: 60 };
  const { props: { srcSet: desktopSet } } = getImageProps({ ...common, src: desktop, width: 1920, height: 1080 });
  const { props: { srcSet: mobileSet, ...rest } } = getImageProps({ ...common, src: mobile, width: 750, height: 938, loading: "eager", fetchPriority: "high" });
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktopSet} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative; alt="" comes from props */}
      <img {...rest} srcSet={mobileSet} className="absolute inset-0 h-full w-full object-cover" />
    </picture>
  );
}
