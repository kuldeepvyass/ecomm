# Maison Horlogère — Design System (Master)

Source: ui-ux-pro-max `--design-system` ("luxury watch ecommerce dark gold boutique", variance 3 / motion 4 / density 3),
adapted to a dark-first theme. Tokens live in `src/app/globals.css`; components use semantic tokens only.

- **Style:** Minimalism & Swiss — spacious, grid-based, high contrast, restrained. One accent (champagne gold).
- **Type:** Cormorant (display, 500) + Montserrat (body/UI). Body 16px / 1.6. Eyebrows 11px, 0.22em tracking, uppercase.
  Brand names in small caps.
- **Colour:** see `:root` / `[data-theme="light"]`. Gold on bg ≥ 4.5:1 in both themes; on-gold text is near-black (dark) / white (light).
- **Spacing:** sections 64–128px apart on desktop, 48–80px mobile. Cards gap 16px mobile, 24–32px desktop.
- **Radii:** 2px (controls), 4px (cards). Luxury reads better nearly square.
- **Motion:** 200–450ms; enter `--ease-luxe` (expo-out), exit faster with `--ease-exit`. Transform/opacity only.
  Button press `scale(0.97)`. Everything disabled under `prefers-reduced-motion`.
- **Touch:** ≥44px targets, 8px+ spacing; bottom nav ≤5 items; bottom-sheet filters on mobile.
- **Images:** `next/image`, fixed aspect ratios (4:5 cards, 1:1 gallery), blur placeholders, `priority` only on LCP.

## Anti-patterns (from the skill)
Vibrant/block colours, playful palettes, emoji icons, hover-only affordances, placeholder-only labels, layout shift.

## Pre-delivery checklist
- [ ] No emoji icons (Lucide SVG)
- [ ] cursor-pointer on clickables; hover transitions 150–300ms
- [ ] Contrast ≥ 4.5:1 in both themes
- [ ] Visible focus rings
- [ ] prefers-reduced-motion respected
- [ ] 375 / 768 / 1024 / 1440 checked
