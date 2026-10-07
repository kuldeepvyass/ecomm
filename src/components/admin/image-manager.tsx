"use client";

import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Link2, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { LINKED_IMAGE_PROPS, cdnLoader, isLinkedImage } from "@/lib/image-loader";
import { cn } from "@/lib/utils";

export type ManagedImage = { url: string; publicId?: string | null; alt?: string | null; width: number; height: number; blurDataUrl?: string | null };

async function uploadFile(file: File, purpose: string): Promise<ManagedImage> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("purpose", purpose);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data;
}

function Tile({ img, index, onRemove, onAlt }: { img: ManagedImage; index: number; onRemove: () => void; onAlt: (v: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.url });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex flex-col gap-1", isDragging && "z-10 opacity-80")}>
      <div className="group relative aspect-[4/5] overflow-hidden border border-border bg-surface-2">
        {isLinkedImage(img.url)
          ? <Image {...LINKED_IMAGE_PROPS} src={img.url} alt={img.alt ?? ""} fill sizes="160px" className="bg-white object-contain" />
          : <Image loader={cdnLoader} src={img.url} alt={img.alt ?? ""} fill sizes="160px" className="object-cover" />}
        {isLinkedImage(img.url) && <span className="absolute bottom-1 right-1 grid size-6 place-items-center rounded-full bg-bg/80" title="Linked image (not stored on this server)"><Link2 className="size-3.5" aria-hidden /></span>}
        {index === 0 && <span className="absolute bottom-1 left-1 bg-gold px-1.5 text-[0.625rem] uppercase tracking-wider text-on-gold">Cover</span>}
        <button type="button" {...attributes} {...listeners} aria-label={`Drag to reorder image ${index + 1}`}
          className="absolute left-1 top-1 grid size-9 cursor-grab place-items-center rounded-full bg-bg/80 active:cursor-grabbing"><GripVertical className="size-4" aria-hidden /></button>
        <button type="button" onClick={onRemove} aria-label={`Remove image ${index + 1}`} className="absolute right-1 top-1 grid size-9 place-items-center rounded-full bg-bg/80 hover:text-danger"><X className="size-4" aria-hidden /></button>
      </div>
      <input value={img.alt ?? ""} onChange={(e) => onAlt(e.target.value)} placeholder="Alt text" aria-label={`Alt text for image ${index + 1}`}
        className="h-9 rounded-[2px] border border-border bg-surface px-2 text-xs" />
    </li>
  );
}

/** Drag-and-drop upload + sortable grid. First image is the cover. */
export function ImageManager({ images, onChange, purpose = "products", max = 12 }: { images: ManagedImage[]; onChange: (v: ManagedImage[]) => void; purpose?: string; max?: number }) {
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const [link, setLink] = useState("");

  function addLink() {
    const url = link.trim();
    if (!/^https:\/\/[^\s]+$/i.test(url)) return toast.error("Paste a full https:// image link");
    if (images.some((i) => i.url === url)) return toast.error("That image is already added");
    if (images.length >= max) return toast.error(`Up to ${max} images`);
    onChange([...images, { url, publicId: null, width: 1000, height: 1000, blurDataUrl: null }]);
    setLink("");
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function addFiles(files: File[]) {
    const room = max - images.length;
    const list = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (!list.length) return;
    setUploading(list.length);
    let acc = images;
    for (const f of list) {
      try {
        const img = await uploadFile(f, purpose);
        acc = [...acc, img];
        onChange(acc);
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = images.findIndex((i) => i.url === e.active.id);
    const to = images.findIndex((i) => i.url === e.over!.id);
    onChange(arrayMove(images, from, to));
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void addFiles(Array.from(e.dataTransfer.files)); }}
        className={cn("flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-6 text-center text-sm transition-colors",
          over ? "border-gold bg-gold-soft text-gold" : "border-border-strong text-fg-muted hover:border-gold hover:text-gold")}>
        {uploading > 0 ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
        <span>{uploading > 0 ? `Uploading ${uploading}…` : "Drop images here or click to browse"}</span>
        <span className="text-xs text-fg-subtle">JPG, PNG, WebP or AVIF · up to 10 MB each · {images.length}/{max}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </label>
      <div className="flex gap-2">
        <label htmlFor={`img-link-${purpose}`} className="sr-only">Image link</label>
        <input id={`img-link-${purpose}`} value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
          inputMode="url" placeholder="…or paste an image link (https://…) — not stored on this server" className="h-11 min-w-0 flex-1 rounded-[2px] border border-border bg-surface px-3 text-sm" />
        <button type="button" onClick={addLink} className="inline-flex h-11 items-center gap-1.5 rounded-[2px] border border-border px-3 text-sm hover:border-gold hover:text-gold"><Link2 className="size-4" aria-hidden /> Add link</button>
      </div>
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={images.map((i) => i.url)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {images.map((img, i) => (
                <Tile key={img.url} img={img} index={i}
                  onRemove={() => onChange(images.filter((x) => x.url !== img.url))}
                  onAlt={(v) => onChange(images.map((x) => (x.url === img.url ? { ...x, alt: v } : x)))} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
