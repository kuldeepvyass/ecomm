"use client";

import { ImagePlus, Loader2, Star, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { submitReview } from "@/server/actions/reviews";

type Img = { url: string; width: number; height: number; publicId?: string };

export function ReviewForm({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<Img[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 4 - images.length)) {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("purpose", "reviews");
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) toast.error(data.error ?? "Upload failed");
        else setImages((prev) => [...prev, { url: data.url, width: data.width, height: data.height, publicId: data.publicId }]);
      }
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    start(async () => {
      const res = await submitReview({ productId, rating, title, body, images });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Thank you!");
      router.push("/account/reviews");
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex max-w-2xl flex-col gap-6" noValidate data-testid="review-form">
      <fieldset>
        <legend className="eyebrow mb-3 text-fg-muted">Your rating for {productName} <span className="text-gold">*</span></legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} className="grid size-11 place-items-center" data-testid={`star-${n}`}>
              <Star className={cn("size-8 transition-colors", (hover || rating) >= n ? "fill-gold text-gold" : "text-border-strong")} strokeWidth={1.25} />
            </button>
          ))}
        </div>
        {errors.rating && <p role="alert" className="mt-2 text-sm text-danger">{errors.rating[0]}</p>}
      </fieldset>
      <Field label="Title" error={errors.title} required>{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Sum it up in a few words" />}</Field>
      <Field label="Your review" error={errors.body} required hint={`${body.length}/4000`}>
        {(p) => <Textarea {...p} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={6} placeholder="How does it wear? How's the finishing, accuracy, comfort?" />}
      </Field>
      <div>
        <p className="eyebrow mb-3 text-fg-muted">Photos (optional, up to 4)</p>
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.url} className="relative size-24 overflow-hidden bg-surface-2">
              <Image src={img.url} alt="Your photo" fill sizes="96px" className="object-cover" />
              <button type="button" onClick={() => setImages((p) => p.filter((x) => x.url !== img.url))} aria-label="Remove photo" className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-bg/80"><X className="size-4" aria-hidden /></button>
            </div>
          ))}
          {images.length < 4 && (
            <label className="grid size-24 cursor-pointer place-items-center border border-dashed border-border-strong text-fg-muted hover:border-gold hover:text-gold">
              {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
              <span className="sr-only">Add photos</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={(e) => void upload(e.target.files)} />
            </label>
          )}
        </div>
      </div>
      <Button type="submit" loading={pending} disabled={uploading} className="self-start">Submit review</Button>
      <p className="text-xs text-fg-subtle">Reviews are checked by our team before publishing. Only verified purchases can be reviewed.</p>
    </form>
  );
}
