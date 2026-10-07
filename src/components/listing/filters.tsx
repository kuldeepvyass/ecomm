"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { FILTER_KEYS, GENDER_OPTIONS, MOVEMENT_OPTIONS, SIZE_OPTIONS, SORT_OPTIONS } from "./filter-options";

export type Facets = {
  brands: { name: string; slug: string; count: number }[];
  straps: { value: string; count: number }[];
  dials: { value: string; count: number }[];
  types: { value: string; count: number }[];
  shapes: { value: string; count: number }[];
  movements: Record<string, number>;
  priceMin: number;
  priceMax: number;
};

type Lock = { brand?: boolean; gender?: boolean };

function useParamsState() {
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k);
  const list = (k: string) => (sp.get(k)?.split(",").filter(Boolean) ?? []);
  return { sp, get, list };
}

function useNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const go = (params: URLSearchParams) => {
    params.delete("cursor");
    const qs = params.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { go, pending };
}

/** Collapsible filter section. Starts open only when it already has a selection. */
function Section({ title, summary, defaultOpen, children }: { title: string; summary?: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group/sec border-b border-border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="eyebrow text-fg">{title}</span>
        {summary && <span className="ml-auto max-w-[55%] truncate text-xs text-gold">{summary}</span>}
        <ChevronDown className={cn("size-4 shrink-0 text-fg-muted transition-transform group-open/sec:rotate-180", !summary && "ml-auto")} aria-hidden />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

function CheckRow({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-5 shrink-0 accent-[var(--gold)]" />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-fg-subtle">{count}</span>}
    </label>
  );
}

const STEP = 1000;

/** Two-handle price range. Moves locally; commits to the URL when the handle is released. */
function PriceSlider({ floor, ceil, min, max, onCommit }: {
  floor: number; ceil: number; min?: number; max?: number; onCommit: (min?: number, max?: number) => void;
}) {
  const lo = Math.floor(floor / STEP) * STEP;
  const hi = Math.max(lo + STEP, Math.ceil(ceil / STEP) * STEP);
  const [range, setRange] = useState<[number, number]>([min ?? lo, max ?? hi]);
  const [synced, setSynced] = useState(`${min}-${max}`);
  if (synced !== `${min}-${max}`) {
    setSynced(`${min}-${max}`);
    setRange([min ?? lo, max ?? hi]);
  }
  const commit = () => onCommit(range[0] > lo ? range[0] : undefined, range[1] < hi ? range[1] : undefined);
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const thumb = "pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold [&::-webkit-slider-thumb]:bg-bg [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gold [&::-moz-range-thumb]:bg-bg";
  const handlers = { onPointerUp: commit, onKeyUp: commit, onTouchEnd: commit };
  return (
    <div className="pt-1" data-testid="price-slider">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums">{formatINR(range[0])}</span>
        <span className="text-fg-subtle">to</span>
        <span className="font-medium tabular-nums">{formatINR(range[1])}{range[1] >= hi ? "+" : ""}</span>
      </div>
      <div className="relative mx-3 mt-4 h-8">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-border" />
        <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-gold" style={{ left: `${pct(range[0])}%`, right: `${100 - pct(range[1])}%` }} />
        <input type="range" aria-label="Minimum price" min={lo} max={hi} step={STEP} value={range[0]} {...handlers}
          onChange={(e) => setRange([Math.min(Number(e.target.value), range[1] - STEP), range[1]])} className={thumb} />
        <input type="range" aria-label="Maximum price" min={lo} max={hi} step={STEP} value={range[1]} {...handlers}
          onChange={(e) => setRange([range[0], Math.max(Number(e.target.value), range[0] + STEP)])} className={thumb} />
      </div>
    </div>
  );
}

/** Edits a draft copy of the URL params; desktop applies instantly, mobile on "Show results". */
function FilterBody({ facets, draft, setDraft, lock }: {
  facets: Facets;
  draft: URLSearchParams;
  setDraft: (p: URLSearchParams) => void;
  lock: Lock;
}) {
  const [brandQuery, setBrandQuery] = useState("");
  const list = (k: string) => draft.get(k)?.split(",").filter(Boolean) ?? [];
  const toggle = (k: string, v: string) => {
    const next = new URLSearchParams(draft);
    const cur = list(k);
    const vals = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    if (vals.length) next.set(k, vals.join(","));
    else next.delete(k);
    setDraft(next);
  };
  const setPrice = (min?: number, max?: number) => {
    const next = new URLSearchParams(draft);
    next.delete("min");
    next.delete("max");
    if (min !== undefined) next.set("min", String(min));
    if (max !== undefined) next.set("max", String(max));
    setDraft(next);
  };
  /** "Leather, Mesh" / "3 selected" for a section header. */
  const picked = (k: string, label: (v: string) => string = (v) => v) => {
    const v = list(k);
    return v.length === 0 ? undefined : v.length <= 2 ? v.map(label).join(", ") : `${v.length} selected`;
  };
  const num = (k: string) => (draft.get(k) ? Number(draft.get(k)) : undefined);
  const brands = brandQuery ? facets.brands.filter((b) => b.name.toLowerCase().includes(brandQuery.toLowerCase())) : facets.brands;
  const brandName = (slug: string) => facets.brands.find((b) => b.slug === slug)?.name ?? slug;
  const movements = MOVEMENT_OPTIONS.filter((m) => facets.movements[m.value] || list("movement").includes(m.value));

  return (
    <div>
      <section aria-labelledby="price-filter" className="border-b border-border pb-6">
        <h3 id="price-filter" className="eyebrow mb-3 text-fg">Price</h3>
        <PriceSlider floor={facets.priceMin} ceil={facets.priceMax} min={num("min")} max={num("max")} onCommit={setPrice} />
      </section>

      <div className="flex flex-wrap items-center gap-2 border-b border-border py-4">
        {!lock.gender && GENDER_OPTIONS.map((g) => {
          const active = draft.get("gender") === g.value;
          return (
            <button key={g.value} type="button" aria-pressed={active}
              onClick={() => { const n = new URLSearchParams(draft); if (active) n.delete("gender"); else n.set("gender", g.value); setDraft(n); }}
              className={cn("min-h-10 rounded-full border px-4 text-sm transition-colors", active ? "border-gold bg-gold-soft text-gold" : "border-border hover:border-border-strong")}>
              {g.label}
            </button>
          );
        })}
        <label className="ml-auto flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.get("instock") === "1"} className="size-5 accent-[var(--gold)]"
            onChange={() => { const n = new URLSearchParams(draft); if (n.get("instock") === "1") n.delete("instock"); else n.set("instock", "1"); setDraft(n); }} />
          In stock only
        </label>
      </div>

      {!lock.brand && facets.brands.length > 0 && (
        <Section title="Brand" summary={picked("brand", brandName)} defaultOpen={list("brand").length > 0}>
          {facets.brands.length > 8 && (
            <input type="search" value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} placeholder={`Search ${facets.brands.length} brands`}
              aria-label="Search brands" className="mb-2 h-10 w-full rounded-[2px] border border-border bg-bg px-3 text-base sm:text-sm" />
          )}
          <div className="max-h-72 overflow-y-auto overscroll-contain pr-1">
            {brands.map((b) => (
              <CheckRow key={b.slug} label={b.name} count={b.count} checked={list("brand").includes(b.slug)} onChange={() => toggle("brand", b.slug)} />
            ))}
            {brands.length === 0 && <p className="py-2 text-sm text-fg-subtle">No brand matches “{brandQuery}”.</p>}
          </div>
        </Section>
      )}
      {facets.types.length > 1 && (
        <Section title="Type" summary={picked("type")} defaultOpen={list("type").length > 0}>
          {facets.types.map((t) => (
            <CheckRow key={t.value} label={t.value} count={t.count} checked={list("type").includes(t.value)} onChange={() => toggle("type", t.value)} />
          ))}
        </Section>
      )}
      <Section title="Movement" summary={picked("movement", (v) => MOVEMENT_OPTIONS.find((m) => m.value === v)?.label ?? v)} defaultOpen={list("movement").length > 0}>
        {movements.map((m) => (
          <CheckRow key={m.value} label={m.label} count={facets.movements[m.value]} checked={list("movement").includes(m.value)} onChange={() => toggle("movement", m.value)} />
        ))}
      </Section>
      {facets.straps.length > 0 && (
        <Section title="Strap / bracelet" summary={picked("strap")} defaultOpen={list("strap").length > 0}>
          {facets.straps.map((s) => (
            <CheckRow key={s.value} label={s.value} count={s.count} checked={list("strap").includes(s.value)} onChange={() => toggle("strap", s.value)} />
          ))}
        </Section>
      )}
      <Section title="Case size" summary={picked("size", (v) => SIZE_OPTIONS.find((o) => o.value === v)?.label ?? v)} defaultOpen={list("size").length > 0}>
        {SIZE_OPTIONS.map((s) => (
          <CheckRow key={s.value} label={s.label} checked={list("size").includes(s.value)} onChange={() => toggle("size", s.value)} />
        ))}
      </Section>
      {facets.shapes.length > 1 && (
        <Section title="Case shape" summary={picked("shape")} defaultOpen={list("shape").length > 0}>
          {facets.shapes.map((t) => (
            <CheckRow key={t.value} label={t.value} count={t.count} checked={list("shape").includes(t.value)} onChange={() => toggle("shape", t.value)} />
          ))}
        </Section>
      )}
      {facets.dials.length > 0 && (
        <Section title="Dial colour" summary={picked("dial")} defaultOpen={list("dial").length > 0}>
          <div className="max-h-72 overflow-y-auto overscroll-contain pr-1">
            {facets.dials.map((d) => (
              <CheckRow key={d.value} label={d.value} count={d.count} checked={list("dial").includes(d.value)} onChange={() => toggle("dial", d.value)} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function DesktopFilters({ facets, lock = {} }: { facets: Facets; lock?: Lock }) {
  const { sp } = useParamsState();
  const { go } = useNavigate();
  const key = sp.toString();
  // Optimistic: controls reflect the click immediately; the URL (and results) follow.
  const [draft, setDraft] = useState(() => new URLSearchParams(key));
  const [synced, setSynced] = useState(key);
  if (synced !== key) {
    setSynced(key);
    setDraft(new URLSearchParams(key));
  }
  return (
    <aside aria-label="Filters" className="hidden lg:block">
      <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-4 no-scrollbar">
        <FilterBody facets={facets} draft={draft} setDraft={(p) => { setDraft(p); go(p); }} lock={lock} />
      </div>
    </aside>
  );
}

export function ListingToolbar({ facets, total, lock = {}, showRelevance = false }: {
  facets: Facets;
  total: number;
  lock?: Lock;
  showRelevance?: boolean;
}) {
  const { sp, list, get } = useParamsState();
  const { go, pending } = useNavigate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => new URLSearchParams(sp.toString()));
  const activeCount = FILTER_KEYS.filter((k) => !(lock.brand && k === "brand") && !(lock.gender && k === "gender") && sp.has(k)).length;

  const chips: { key: string; value?: string; label: string }[] = [];
  if (!lock.gender && get("gender")) chips.push({ key: "gender", label: get("gender") === "MEN" ? "Men" : "Women" });
  if (get("instock")) chips.push({ key: "instock", label: "In stock" });
  if (!lock.brand) for (const b of list("brand")) chips.push({ key: "brand", value: b, label: facets.brands.find((x) => x.slug === b)?.name ?? b });
  if (get("min") || get("max")) chips.push({ key: "price", label: `${get("min") ? formatINR(Number(get("min"))) : "₹0"} – ${get("max") ? formatINR(Number(get("max"))) : "any"}` });
  for (const s of list("size")) chips.push({ key: "size", value: s, label: SIZE_OPTIONS.find((o) => o.value === s)?.label ?? s });
  for (const t of list("type")) chips.push({ key: "type", value: t, label: t });
  for (const t of list("shape")) chips.push({ key: "shape", value: t, label: `${t} case` });
  for (const m of list("movement")) chips.push({ key: "movement", value: m, label: MOVEMENT_OPTIONS.find((o) => o.value === m)?.label ?? m });
  for (const s of list("strap")) chips.push({ key: "strap", value: s, label: s });
  for (const d of list("dial")) chips.push({ key: "dial", value: d, label: `${d} dial` });

  const removeChip = (c: (typeof chips)[number]) => {
    const next = new URLSearchParams(sp.toString());
    if (c.key === "price") { next.delete("min"); next.delete("max"); }
    else if (c.value) {
      const vals = list(c.key).filter((v) => v !== c.value);
      if (vals.length) next.set(c.key, vals.join(",")); else next.delete(c.key);
    } else next.delete(c.key);
    go(next);
  };
  const clearAll = () => {
    const next = new URLSearchParams(sp.toString());
    for (const k of FILTER_KEYS) if (!(lock.brand && k === "brand") && !(lock.gender && k === "gender")) next.delete(k);
    go(next);
  };

  return (
    <div className="mb-6 flex flex-col gap-4" aria-busy={pending}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="shrink-0 text-sm text-fg-muted" aria-live="polite">{total} {total === 1 ? "watch" : "watches"}</p>
        <div className="flex min-w-0 items-center gap-2">
          <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(new URLSearchParams(sp.toString())); }} title="Filter" side="left"
            trigger={
              <Button variant="outline" size="sm" className="lg:hidden" data-testid="open-filters">
                <SlidersHorizontal aria-hidden /> Filter{activeCount ? ` (${activeCount})` : ""}
              </Button>
            }
            footer={
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { const n = new URLSearchParams(draft); for (const k of FILTER_KEYS) if (!(lock.brand && k === "brand") && !(lock.gender && k === "gender")) n.delete(k); setDraft(n); }}>Clear</Button>
                <Button className="flex-[2]" data-testid="apply-filters" onClick={() => { go(draft); setOpen(false); }}>Show results</Button>
              </div>
            }>
            <FilterBody facets={facets} draft={draft} setDraft={setDraft} lock={lock} />
          </Sheet>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select id="sort" value={get("sort") ?? (showRelevance ? "relevance" : "recommended")}
            onChange={(e) => { const n = new URLSearchParams(sp.toString()); n.set("sort", e.target.value); go(n); }}
            className="h-10 min-w-0 max-w-44 truncate rounded-[2px] border border-border bg-surface px-2 text-xs uppercase tracking-[0.08em] text-fg focus:border-gold focus:outline-none sm:max-w-none sm:px-3 sm:tracking-[0.12em]">
            {showRelevance && <option value="relevance">Best match</option>}
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Active filters">
          {chips.map((c) => (
            <li key={`${c.key}-${c.value ?? ""}`}>
              <button type="button" onClick={() => removeChip(c)} aria-label={`Remove filter ${c.label}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border-strong px-3 text-xs hover:border-gold hover:text-gold">
                {c.label} <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={clearAll} className="inline-flex min-h-9 items-center px-2 text-xs text-gold underline underline-offset-4 hover:decoration-2">Clear all</button>
          </li>
        </ul>
      )}
    </div>
  );
}
