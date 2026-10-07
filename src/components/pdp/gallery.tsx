"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { WatchImage } from "@/components/product/watch-image";
import { cn } from "@/lib/utils";

// Full-screen viewer (Radix Dialog + zoom) loads on first open.
const Viewer = dynamic(() => import("./gallery-viewer").then((m) => m.Viewer), { ssr: false });

export type GImage = { id: string; url: string; alt: string; width: number; height: number; blurDataUrl: string | null };

/** Swipeable gallery: hover-zoom on desktop, tap → fullscreen viewer with double-tap / pinch zoom. */
export function Gallery({ images, title }: { images: GImage[]; title: string }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: images.length > 1, align: "start" });
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const [viewerUsed, setViewerUsed] = useState(false);
  const openViewer = () => { setViewerUsed(true); setViewer(true); };

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    return () => { embla.off("select", onSelect); };
  }, [embla]);

  const goTo = useCallback((i: number) => embla?.scrollTo(i), [embla]);

  if (images.length === 0) return <div className="aspect-[4/5] bg-surface-2" />;

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:gap-4" aria-roledescription="carousel" aria-label={`${title} images`}>
      {images.length > 1 && (
        <ul className="hidden max-h-[44rem] flex-col gap-3 overflow-y-auto no-scrollbar md:flex" aria-label="Thumbnails">
          {images.map((img, i) => (
            <li key={img.id}>
              <button type="button" onClick={() => goTo(i)} aria-label={`Show image ${i + 1}`} aria-current={i === index}
                className={cn("relative block aspect-[4/5] w-20 overflow-hidden bg-surface-2 transition-opacity", i === index ? "ring-1 ring-gold" : "opacity-60 hover:opacity-100")}>
                <WatchImage src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative min-w-0 flex-1">
        <div className="overflow-hidden bg-surface-2" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {images.map((img, i) => (
              <div key={img.id} className="relative min-w-0 flex-[0_0_100%]" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${images.length}`}>
                <HoverZoom onOpen={() => { setIndex(i); openViewer(); }}>
                  <WatchImage src={img.url} alt={img.alt} fill priority={i === 0} quality={i === 0 ? 65 : 75} sizes="(min-width: 1024px) 50vw, 100vw"
                    blurDataUrl={img.blurDataUrl} className="object-cover" />
                </HoverZoom>
              </div>
            ))}
          </div>
        </div>
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => embla?.scrollPrev()} aria-label="Previous image"
              className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-bg/70 backdrop-blur-sm transition-colors hover:text-gold md:grid">
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => embla?.scrollNext()} aria-label="Next image"
              className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-bg/70 backdrop-blur-sm transition-colors hover:text-gold md:grid">
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
              {images.map((img, i) => (
                <span key={img.id} className={cn("h-1 rounded-full bg-white/50 transition-all duration-300", i === index ? "w-6 bg-white" : "w-1.5")} />
              ))}
            </div>
          </>
        )}
        <button type="button" onClick={openViewer} aria-label="Open full-screen gallery"
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-bg/70 backdrop-blur-sm hover:text-gold">
          <Expand className="size-4" aria-hidden />
        </button>
      </div>
      {viewerUsed && <Viewer open={viewer} onOpenChange={setViewer} images={images} start={index} title={title} />}
    </div>
  );
}

/** Desktop: image follows the cursor at 2× scale. Touch devices skip this and open the viewer. */
function HoverZoom({ children, onOpen }: { children: React.ReactNode; onOpen: () => void }) {
  const [origin, setOrigin] = useState<string | null>(null);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Zoom image"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
      }}
      onPointerLeave={() => setOrigin(null)}
      className="relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden"
    >
      <span className="absolute inset-0 block transition-transform duration-200 ease-out"
        style={{ transform: origin ? "scale(2)" : undefined, transformOrigin: origin ?? "center" }}>
        {children}
      </span>
    </button>
  );
}

