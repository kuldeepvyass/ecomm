# Luxury Watch Store: Build Plan

Status: **draft, awaiting your approval.** Schema: [`prisma/schema.prisma`](prisma/schema.prisma) (passes `prisma validate`).

## 1. Stack (versions checked on npm, 2026-10-06)

| Concern | Choice | Notes |
|---|---|---|
| App | **Next.js 16.3** (App Router, RSC, Server Actions), TypeScript strict | |
| Styling / motion | **Tailwind CSS 4.3**, **Framer Motion 14** (`LazyMotion` + `m.*` to keep the bundle small) | Respects `prefers-reduced-motion` |
| UI primitives | Radix (dialog, sheet, select, tabs) wrapped in our own components; Lucide icons | No emoji icons |
| DB | **PostgreSQL on Neon** (pooled + direct URL), **Prisma 7.10** | Prisma's `latest` npm tag currently points at 8.0 RC, so I'm pinning the last stable release. `pg_trgm` handles typo-tolerant search, so no Algolia. |
| Auth | **Auth.js v5** (`next-auth@5.0.0-beta.32`) + Prisma adapter, database sessions | v5 is still tagged beta but is the App Router-native line. Email sign-in sends **one email with both a magic link and a 6-digit OTP**. Google OAuth. `CUSTOMER` / `ADMIN` roles. |
| Payments | **Razorpay** Orders API + Checkout.js; HMAC signature check on the client callback **and** the webhook | COD is an admin toggle |
| Images | **Cloudinary** (signed uploads, `f_auto,q_auto` → AVIF/WebP, responsive `w_` via a custom `next/image` loader, blur placeholders stored on upload) | |
| Email | **Resend** + React Email templates | |
| PDF | `@react-pdf/renderer` for GST invoice and packing slip | |
| Import / export | `exceljs` (XLSX), `papaparse` (CSV), `fflate` (ZIP of images) | |
| Validation | **Zod** on every Server Action and route handler | |
| Rate limiting | Postgres fixed-window (`RateLimit` table) | Can swap to Upstash later via one interface |
| Observability | `@sentry/nextjs` wired up but off until `SENTRY_DSN` is set; `pino` structured logs | |
| Tests | Vitest, Playwright (iPhone 14, Pixel 7, Desktop Chrome), `@axe-core/playwright`, `@lhci/cli` | |
| Hosting | Vercel | |

Location: `luxury-watch-store/` is a new standalone project inside your `interview ai` folder. It's separate from the existing InterviewPilot app and gets its own git repo.

## 2. Design system (from ui-ux-pro-max)

The skill's `--design-system` run for "luxury watch e-commerce, dark, gold, boutique" returned:

- **Style:** Minimalism / Swiss: spacious, grid-based, high contrast, restrained. That matches "Swiss maison" closely.
- **Typography:** **Cormorant** (display serif) + **Montserrat** (body/UI), loaded through `next/font` (self-hosted, no layout shift). Brand names use small caps with Montserrat 500 and `tracking-[0.2em]`.
- **Palette:** "E-commerce Luxury: premium dark + gold accent". The skill's palette is light-first, so I derived the **dark default** from it and kept its ivory values for the light theme:

| Token | Dark (default) | Ivory (light) |
|---|---|---|
| `--bg` | `#0B0A09` | `#FAF7F2` |
| `--surface` | `#141210` | `#FFFFFF` |
| `--surface-2` | `#1C1A17` | `#F3EEE6` |
| `--border` | `#2A2622` | `#E7E2D9` |
| `--fg` | `#F5F1EA` | `#1C1917` |
| `--fg-muted` | `#A39E95` | `#57534E` |
| `--gold` (accent/CTA) | `#C9A96E` champagne | `#8B6B32` (darkened to reach 4.5:1 on ivory) |
| `--on-gold` | `#0B0A09` | `#FFFFFF` |
| `--danger` / `--success` | `#E5484D` / `#3FB68B` | `#C62828` / `#1E7A55` |

- **Spacing:** spacious scale (24–96px between sections). Each component uses semantic tokens only, never raw hex.
- **Motion:** 200–450ms. Ease-out on enter, faster exits. Staggered fade-up on grids. The hero uses slow parallax built from transform and opacity only. Buttons have a press-scale of 0.97. All motion is skipped under reduced-motion.
- **Skill rules I'll enforce:** 4.5:1 contrast, visible focus rings, 44px+ tap targets, `next/image` everywhere with `priority` only on the LCP image, reserved aspect ratios (CLS < 0.1), labelled inputs with errors next to the field, wrapping filter chips, bottom nav limited to 5 items, and `inputmode="numeric"` on PIN and phone fields. I'll run the skill's pre-delivery checklist before each phase is marked done.

I'll save this as `design-system/MASTER.md` in the repo.

## 3. Key architecture decisions

1. **Pricing is computed server-side only.** `lib/pricing.ts` is a pure function and gets unit tests:
   `pct = product.discountOverridePct ?? (product.excludeFromGlobalDiscount ? 0 : settings.globalDiscountPct)`
   `sellingPrice = round(mrp × (1 − pct/100))`
   The result is stored in `Product.sellingPrice` so price filters and sorts run in SQL. Saving the global % does the following in **one transaction**:
   1. Snapshot the old prices.
   2. Run a single set-based `UPDATE` to reprice every product.
   3. Write the `PriceChangeLog` header and per-product rows.
   4. Call `revalidateTag('products')`.

   The admin sees a dry-run preview before saving. Cart, checkout and the Razorpay amount are always recomputed from the DB.
2. **Order lifecycle** is a typed state machine (`lib/orders/transitions.ts`) and every transition goes through it. Each transition writes an `OrderStatusEvent`, sends an email and logs an audit entry. Invalid transitions are rejected and unit-tested.
3. **Stock:**
   - Availability is checked when the order is created.
   - On payment capture, each item runs a conditional decrement: `UPDATE … SET stock = stock - q WHERE id = ? AND stock >= q`.
   - If any item has run out by then, the order is auto-refunded and marked `CANCELLED`, so there's no overselling.
   - Stock is restored on cancel and return. COD orders decrement at placement.
4. **Idempotency:**
   - Checkout sends a client-generated `idempotencyKey`, which is unique on `Order`.
   - Webhook event IDs are stored in `WebhookEvent`.
   - The capture handler is safe to run twice, because the client callback and the webhook can both arrive.
5. **Search:** `Product.searchText` (brand, model, reference, calibre) has a trigram GIN index. Ranking is `similarity()` plus exact reference matches. Suggestions are debounced at 200ms and rate-limited.
6. **Listings:** keyset (cursor) pagination on `(sortKey, id)` drives infinite scroll. Filters live in the URL, so results are shareable and the back button works.
7. **Caching:** Product, listing, brand and collection pages use ISR with `revalidateTag`. Tags are invalidated by admin edits, imports, discount changes, review approval and stock changes. Cart, profile and checkout are dynamic.
8. **Demo data:** demo brands, products, reviews and ratings have `isDemo = true`.
   - A single `hasDemoData()` check (cached, tag `demo`) drives the site-wide preview banner and the "Sample" chips.
   - Demo items are filtered out of `sitemap.xml` and JSON-LD.
   - "Delete all sample data" removes the DB rows and Cloudinary assets, then revalidates.
9. **Security:**
   - The admin guard runs in a server layout **and** in every admin action, not just middleware.
   - Server Actions get Next's built-in origin check for CSRF. Route handlers check `Origin` and use SameSite=Lax secure cookies.
   - Zod runs on all inputs and review text is sanitised.
   - `costPrice` never appears in storefront selects.
   - CSP headers are set.
10. **Delivery estimate:** PIN format validation, then a longest-prefix match on the admin-editable `ShippingZone` table gives the "Delivered by Thu, 12 Oct" estimate and whether COD is available. I'll seed zones by postal circle (first 1–2 digits). A courier API like Shiprocket can replace this later behind the same function.
11. **GST invoice:** prices are GST-inclusive. Taxable value = price / (1 + rate). The store's state and the shipping state decide CGST+SGST vs IGST. Invoice numbers come from an atomic per-financial-year `Counter`.

## 4. Phases (each one ends with tests passing and PROGRESS.md updated)

1. **Foundation:** scaffold, tokens and theme (dark/ivory), fonts, base components (Button, Sheet, Toast, Skeleton, PriceTag, Rating), layout shell with header, footer, mobile bottom nav and preview banner. Neon + Prisma migrations. Auth.js (email OTP/magic link + Google), roles, admin guard. Pricing and transition libs with Vitest.
2. **Admin catalog:**
   - Products list with search, filters, inline stock, bulk actions, soft delete/restore and duplicate.
   - Add/Edit form with drag-drop Cloudinary upload and reordering.
   - Bulk importer: template download, CSV/XLSX + ZIP/URL images, preview with row errors, then commit. Supports upsert, column-subset update, delete/deactivate by SKU, export, and history with summaries. Tested with 250 rows.
   - Global discount with preview and change log; per-product override.
   - Seed: 20 demo watches, reviews and settings.
3. **Storefront:** home (cinematic hero, collections, brand story strips, trust badges, featured, recently viewed), shop with infinite scroll and bottom-sheet filters, brand and collection pages, instant search, and the product page (zoom/swipe gallery, specs, PIN estimate, EMI note, share, size guide, reviews, related, sticky Add to Bag).
4. **Commerce:**
   - Wishlist and bag (guest cookie with merge on login, save for later, coupons).
   - Checkout (address book, delivery options, Razorpay, COD).
   - Webhooks, order pages with timeline, PDF invoice, cancel, return/exchange, reorder.
   - All status emails.
5. **Customer extras:** profile and its sections, delete account, verified reviews with photos and helpful votes, compare up to 3, back-in-stock alerts, newsletter, WhatsApp button, PWA with offline page, cookie consent.
6. **Admin ops:** dashboard (revenue, AOV, top products, low stock, chart), order management (filters, status, tracking, Razorpay refunds, invoice/packing slip), customers (block/unblock), review moderation with replies, coupons, homepage banners/collections, store settings, audit log viewer.
7. **SEO and legal:** metadata, dynamic OG images, sitemap, robots, Product/Review JSON-LD (real data only), the 8 policy pages, and a performance pass toward Lighthouse ≥ 90.
8. **Ship:** full Playwright run on 3 viewports, axe, LHCI. Fix all failures, deploy to Vercel, configure the Razorpay webhook and smoke-test the live URL. Final README.md and PROGRESS.md.

## 5. Things you should know up front

- **Resend needs a verified domain** to email anyone other than you. Until you have one, magic links and order emails only reach your own address. If you don't own a domain yet, the live site still works, but customer emails will start once you add a domain.
- **Razorpay E2E:** Playwright will drive the real Razorpay **test-mode** checkout popup with a test card or UPI ID. If the popup proves flaky in CI, I'll keep one real-popup test and drive the remaining paths with correctly signed test webhooks. I'll tell you if that happens.
- **Live payments** need Razorpay KYC and approval. The site will run in test mode until you swap in live keys (the README will cover this). The policy pages required for approval are part of Phase 7.
- **Sample images:** I'll hand-pick royalty-free watch photos from Unsplash/Pexels (license allows commercial use, no hotlinking: they get re-hosted on your Cloudinary). Finding 3–5 *matching* angles of one watch is rare in free stock, so some galleries will show related shots of a similar watch. That's fine for previewing the layout, and it's all demo data you delete later.
- **Hero video:** I'll use a free Pexels watch clip, delivered from Cloudinary with a still poster image as the LCP element. The video loads after interaction or idle so mobile Lighthouse stays ≥ 90.
- **COD on ₹15 lakh watches:** I'll add a `codMaxOrderValue` cap in settings, since most couriers won't carry that much cash.

## 6. What I need from you

**Decisions**
1. **Store name** for the logo, emails and invoices. You can change it later in settings. If you have no preference I'll use a working name like "Maison Horlogère".
2. **Seller details for GST invoices:** the business state, plus a GSTIN if you have one (otherwise invoices are labelled "Bill of Supply / GSTIN pending").
3. **Domain:** do you own one for Resend email and the custom domain?

**Credentials (go in `.env`; I'll ask at the right phase)**

| Phase | Service | What |
|---|---|---|
| 1 | Neon | `DATABASE_URL` (pooled) + `DIRECT_URL` (free tier is fine) |
| 1 | Google Cloud | OAuth client ID/secret (I'll give you the exact redirect URIs) |
| 1 | Resend | API key (+ verified domain if available) |
| 2 | Cloudinary | cloud name, API key, API secret |
| 4 | Razorpay | **test** key ID, key secret, webhook secret |
| 8 | Vercel | You run `npx vercel login` once in your terminal, and I handle the rest |
| optional | Sentry | DSN |

Once you approve the plan and schema (or ask for changes) and answer the 3 decisions, I'll start Phase 1. I can scaffold, design the system and build the UI shell before the credentials arrive.
