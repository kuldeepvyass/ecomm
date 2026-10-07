"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { WatchImage } from "@/components/product/watch-image";
import type { GImage } from "./gallery";

export function Viewer({ open, onOpenChange, images, start, title }: {
  open: boolean; onOpenChange: (o: boolean) => void; images: GImage[]; start: number; title: string;
}) {
  const [emblaRef, embla] = useEmblaCarousel({ startIndex: start, loop: images.length > 1, watchDrag: true });
  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => { embla?.reInit({ watchDrag: !zoomed, startIndex: embla.selectedScrollSnap() }); }, [zoomed, embla]);
  useEffect(() => { if (open) embla?.scrollTo(start, true); }, [open, start, embla]);
  useEffect(() => {
    if (!embla) return;
    const reset = () => { setZoomed(false); setPan({ x: 0, y: 0 }); };
    embla.on("select", reset);
    return () => { embla.off("select", reset); };
  }, [embla]);

  const toggleZoom = () => { setZoomed((z) => !z); setPan({ x: 0, y: 0 }); };
  const onPointerDown = (e: RPointerEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 280) toggleZoom();
    lastTap.current = now;
    if (zoomed) drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onPointerMove = (e: RPointerEvent) => {
    if (!zoomed || !drag.current) return;
    setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setZoomed(false); }}>
      <Dialog.Portal>
        <Dialog.Content className="fixed inset-0 z-[60] flex flex-col bg-black text-white data-[state=open]:animate-[fade-in_200ms_ease-out]">
          <Dialog.Title className="sr-only">{title} — image viewer</Dialog.Title>
          <Dialog.Description className="sr-only">Swipe to browse. Double-tap to zoom.</Dialog.Description>
          <div className="flex items-center justify-between p-3">
            <p className="text-xs text-white/70">Double-tap or use the button to zoom</p>
            <div className="flex gap-1">
              <button type="button" onClick={toggleZoom} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label={zoomed ? "Zoom out" : "Zoom in"} aria-pressed={zoomed}>
                <Expand className="size-5" aria-hidden />
              </button>
              <Dialog.Close className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Close viewer">
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden" ref={emblaRef}>
            <div className="flex h-full">
              {images.map((img) => (
                <div key={img.id} className="relative h-full min-w-0 flex-[0_0_100%] overflow-hidden"
                  onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}
                  style={{ touchAction: zoomed ? "none" : "pan-y pinch-zoom" }}>
                  <div className="absolute inset-0 transition-transform duration-200"
                    style={{ transform: zoomed ? `translate(${pan.x}px, ${pan.y}px) scale(2.5)` : undefined }}>
                    <WatchImage src={img.url} alt={img.alt} fill sizes="100vw" quality={85} className="object-contain" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {images.length > 1 && (
            <div className="flex justify-center gap-4 p-4 pb-safe">
              <button type="button" onClick={() => embla?.scrollPrev()} className="grid size-11 place-items-center rounded-full border border-white/30" aria-label="Previous image"><ChevronLeft className="size-5" aria-hidden /></button>
              <button type="button" onClick={() => embla?.scrollNext()} className="grid size-11 place-items-center rounded-full border border-white/30" aria-label="Next image"><ChevronRight className="size-5" aria-hidden /></button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
