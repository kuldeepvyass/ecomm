import { cn } from "@/lib/utils";

/** Wordmark + crown-less monogram (12 hour markers around an M). */
export function Monogram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8", className)} aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const r1 = i % 3 === 0 ? 14.5 : 15.6;
        const r = (v: number) => Math.round(v * 1000) / 1000; // identical SSR/CSR output
        return (
          <line key={i} x1={r(20 + Math.sin(a) * r1)} y1={r(20 - Math.cos(a) * r1)} x2={r(20 + Math.sin(a) * 17)} y2={r(20 - Math.cos(a) * 17)}
            stroke="currentColor" strokeWidth={i % 3 === 0 ? 1.2 : 0.7} />
        );
      })}
      <text x="20" y="25.5" textAnchor="middle" fontFamily="var(--font-display)" fontSize="15" fill="currentColor">M</text>
    </svg>
  );
}

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Monogram className="text-gold" />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display tracking-[0.2em]", compact ? "text-base" : "text-lg md:text-xl")}>MAISON</span>
        <span className="mt-1 font-sans text-[0.5625rem] tracking-[0.42em] text-fg-muted">HORLOGÈRE</span>
      </span>
    </span>
  );
}
