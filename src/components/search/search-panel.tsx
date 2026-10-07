"use client";

import { ArrowRight, Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import { LINKED_IMAGE_PROPS, isLinkedImage } from "@/lib/image-loader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { formatINR } from "@/lib/money";

type Suggestion = {
  products: { id: string; href: string; brand: string; modelName: string; reference: string; price: number; image: { url: string; alt: string } | null }[];
  brands: { name: string; slug: string }[];
};

const POPULAR = ["Chronograph", "Dive", "Automatic", "Rose gold", "Moonphase"];

/** Instant search with debounced suggestions; Enter opens the full results page. */
export function SearchPanel({ initialQuery = "", onNavigate, autoFocus = true }: {
  initialQuery?: string;
  onNavigate?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [data, setData] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const shown = q.trim().length >= 2 ? data : null;

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setData(await res.json());
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  function submit(term = q) {
    const v = term.trim();
    if (!v) return;
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(v)}`);
  }

  return (
    <div>
      <form role="search" onSubmit={(e) => { e.preventDefault(); submit(); }} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-muted" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Search brand, model or reference"
          aria-label="Search watches"
          aria-controls={listId}
          autoComplete="off"
          enterKeyHint="search"
          className="h-14 w-full rounded-[2px] border border-border bg-surface pl-12 pr-12 text-base text-fg placeholder:text-fg-subtle focus:border-gold focus:outline-none"
        />
        {loading ? (
          <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-fg-muted" aria-hidden />
        ) : q ? (
          <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Clear search"
            className="absolute right-1.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-fg-muted hover:text-fg">
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </form>

      <div id={listId} aria-live="polite" className="mt-6">
        {!shown && (
          <div>
            <p className="eyebrow mb-3 text-fg-muted">Popular searches</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((p) => (
                <button key={p} type="button" onClick={() => submit(p)}
                  className="min-h-11 rounded-full border border-border px-4 text-sm transition-colors hover:border-gold hover:text-gold">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {shown && shown.products.length === 0 && shown.brands.length === 0 && (
          <p className="text-fg-muted">No matches for “{q}”. Try a brand name or reference number.</p>
        )}
        {shown && shown.brands.length > 0 && (
          <div className="mb-6">
            <p className="eyebrow mb-2 text-fg-muted">Maisons</p>
            <ul>
              {shown.brands.map((b) => (
                <li key={b.slug}>
                  <Link href={`/watches/${b.slug}`} onClick={onNavigate} className="flex min-h-11 items-center justify-between font-display text-xl hover:text-gold">
                    {b.name} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {shown && shown.products.length > 0 && (
          <div>
            <p className="eyebrow mb-2 text-fg-muted">Watches</p>
            <ul className="divide-y divide-border">
              {shown.products.map((p) => (
                <li key={p.id}>
                  <Link href={p.href} onClick={onNavigate} className="flex items-center gap-4 py-3 transition-colors hover:text-gold">
                    <span className="relative size-16 shrink-0 overflow-hidden bg-surface-2">
                      {p.image && (isLinkedImage(p.image.url) ? <Image {...LINKED_IMAGE_PROPS} src={p.image.url} alt="" fill sizes="64px" className="bg-white object-contain" /> : <Image src={p.image.url} alt="" fill sizes="64px" className="object-cover" />)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="small-caps block text-xs text-fg-muted">{p.brand}</span>
                      <span className="block truncate font-display text-lg">{p.modelName}</span>
                      <span className="block text-xs text-fg-subtle">Ref. {p.reference}</span>
                    </span>
                    <span className="text-sm">{formatINR(p.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => submit()} className="mt-4 flex min-h-11 items-center gap-2 text-sm text-gold hover:underline">
              See all results for “{q}” <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
