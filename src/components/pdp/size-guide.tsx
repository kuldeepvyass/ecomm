"use client";

import { Ruler } from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";

const Sheet = dynamic(() => import("@/components/ui/sheet").then((m) => m.Sheet), { ssr: false });

/**
 * Shows the case drawn to scale across the top of a wrist.
 * Wrist width (mm) ≈ circumference × 0.32 — a common approximation for the flat top of the wrist.
 */
export function SizeGuide({ diameter, lugWidth }: { diameter: number; lugWidth: number | null }) {
  const [wrist, setWrist] = useState(17);
  const [open, setOpen] = useState(false);
  const wristWidth = wrist * 10 * 0.32;
  const ratio = diameter / wristWidth;
  const fit = ratio < 0.62 ? "Discreet — a classic, understated fit." : ratio < 0.78 ? "Balanced — the proportions most people prefer." : ratio < 0.9 ? "Bold — a confident, sporty presence." : "Oversized — the case will span most of your wrist.";
  const scale = 4; // px per mm
  const W = 300;
  return (
    <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-fg-muted underline-offset-4 hover:text-gold hover:underline">
      <Ruler className="size-4" aria-hidden /> Size guide — how will {diameter} mm look on me?
    </button>
    {open && <Sheet open={open} onOpenChange={setOpen} title="Size guide" description={`${diameter} mm case${lugWidth ? ` · ${lugWidth} mm lugs` : ""}`}>
      <div className="flex flex-col gap-6">
        <label className="flex flex-col gap-3">
          <span className="eyebrow text-fg-muted">Your wrist circumference: <span className="text-fg">{wrist} cm</span></span>
          <input type="range" min={14} max={21} step={0.5} value={wrist} onChange={(e) => setWrist(Number(e.target.value))} className="accent-[var(--gold)]" />
        </label>
        <svg viewBox={`0 0 ${W} 180`} className="w-full" role="img" aria-label={`A ${diameter} millimetre case on a ${wrist} centimetre wrist`}>
          <rect x={(W - wristWidth * scale) / 2} y="20" width={wristWidth * scale} height="140" rx="40" fill="var(--surface-3)" />
          {lugWidth && <rect x={(W - lugWidth * scale) / 2} y="0" width={lugWidth * scale} height="180" fill="var(--border-strong)" />}
          <circle cx={W / 2} cy="90" r={(diameter * scale) / 2} fill="var(--surface)" stroke="var(--gold)" strokeWidth="3" />
          <circle cx={W / 2} cy="90" r={(diameter * scale) / 2 - 10} fill="none" stroke="var(--border-strong)" strokeWidth="1" />
          <line x1={W / 2} y1="90" x2={W / 2} y2={90 - (diameter * scale) / 2 + 22} stroke="var(--fg)" strokeWidth="3" strokeLinecap="round" />
          <line x1={W / 2} y1="90" x2={W / 2 + (diameter * scale) / 2 - 30} y2="90" stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm"><strong className="font-medium">{Math.round(ratio * 100)}% of wrist width.</strong> {fit}</p>
        <div className="text-sm text-fg-muted">
          <p className="mb-2 font-medium text-fg">How to measure</p>
          <p>Wrap a soft tape (or a strip of paper) around your wrist just above the wrist bone, then measure its length. Most wrists are 15–19 cm.</p>
          <p className="mt-3">Rule of thumb: under 16 cm suits 34–38 mm; 16–18 cm suits 38–42 mm; above 18 cm wears 42 mm+ comfortably.</p>
        </div>
      </div>
    </Sheet>}
    </>
  );
}
