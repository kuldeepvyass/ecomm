# PROGRESS — Maison Horlogère

_Last updated: 2026-10-07 (final local build)_

## Environment
- Local only for now (store name "Maison Horlogère"; GST state/GSTIN, domain and all service credentials to be supplied later).
- Local Postgres 17 (Homebrew) on **port 5433**, data dir `./.pgdata` (git-ignored). DBs: `maison` (dev), `maison_test` (tests).
- Dev server: **http://localhost:3100** (3000 is used by another project on this machine).
- Without credentials the app degrades safely: emails → `.dev-mail/` + `/dev/mail`; payments → local **test-payment simulator** (disabled in production); uploads → `public/uploads` (Cloudinary required in production).

## Done
### Phase 1 — Foundation ✅
- Next.js 16.3 (App Router, Turbopack), TypeScript strict, Tailwind 4, Framer Motion (LazyMotion), Prisma 7.10 + pg adapter.
- Design system from ui-ux-pro-max → `design-system/MASTER.md`; dark (default) + ivory themes, no-flash theme script.
- Prisma schema + 2 migrations (CHECK constraints for rating 1–5, stock ≥ 0, discount ≤ 90 %, settings singleton).
- Auth.js v5: email **6-digit OTP + magic link in one email**, Google (auto-enabled when keys exist), DB sessions, roles, `ADMIN_EMAILS` bootstrap, OTP brute-force cap (5 attempts/code) + IP/email rate limits.
- Postgres-backed rate limiter; structured logging (pino) + Sentry-ready `reportError` hook; security headers + CSP.
- Seed: settings, shipping zones, coupons (`WELCOME10`, `FLAT5000`), 4 collections, banners, **20 demo watches** (10 men / 10 women, ₹25,175–₹15,00,000, 3–5 images each, 5–20 demo reviews each, sample attributed ratings), all `isDemo = true`.

### Phase 3 — Storefront ✅
- Home (cinematic parallax hero, trust badges, curated collections, The Edit rail, brand story, For Him/Her, new arrivals, recently viewed, maisons).
- Shop / brand / collection / search listings with URL filters (brand, price, case size, movement, strap, dial, gender, in-stock), sort, chips, bottom-sheet filters on mobile, sidebar on desktop, cursor-based infinite scroll.
- Instant search (pg_trgm typo tolerance, reference-number matching, suggestions, ⌘K).
- Product page: swipe gallery + hover zoom + full-screen viewer (double-tap zoom/pan), price/MRP/discount, stock status, EMI info, PIN delivery estimate, share, compare, wishlist, size guide (wrist visual), spec table, reviews (bars, sort, filter by star, pagination, helpful votes), related, sticky mobile Add-to-Bag, Product JSON-LD (real data only).

### Phase 4 — Commerce ✅ (customer side)
- Wishlist (guest localStorage → merged to account on login), bag (qty, remove, save for later, coupons, price breakdown, guest cookie cart merged on login).
- Checkout: address book (Indian format, PIN↔state check), standard/express delivery, Razorpay or COD (admin toggle, value cap, PIN-zone rules), server-side quote, idempotent order creation.
- Razorpay: order creation, client-callback signature verification, signed webhooks (de-duplicated), refunds; atomic stock decrement on payment, auto-refund if stock ran out mid-payment.
- Order status machine with emails on every transition; GST invoice + packing slip PDFs.
- Account: profile, orders (timeline, invoice, cancel, return/exchange, buy again, retry payment), addresses, reviews (verified-purchase only, photos, moderation), notification prefs, delete account.

## Verified manually (browser, mobile 375 px)
- Home, product page, add to bag, PIN estimate, OTP sign-in via dev mailbox, guest bag merge, checkout with new address, IGST calculation (MH→KA), simulated payment → PAID, stock 6→5, invoice no. `MH/26-27/000001`, confirmation email, order timeline, invoice PDF.

## Phase 2/5/6/7 — Admin, extras, SEO ✅ (2026-10-07)
- Admin: dashboard (IST revenue tiles, 30-day chart + table view, top products, low stock, task counters), orders (filters, status machine with courier/AWB, refunds, returns, invoice/packing slip), products (search/filters, bulk activate/deactivate/feature/delete/restore/purge, inline stock, duplicate), add/edit form (drag-drop upload + reorder, live price preview, price history), bulk importer (CSV/XLSX + ZIP/URL images, preview with row errors, upsert / column-subset update / delete-by-SKU, chunked commit, export, history), pricing (global % with preview + change log, overrides), customers (block/unblock), reviews moderation + store replies, coupons, homepage banners/collections, settings (+ one-click "Delete all sample data"), audit log.
- PWA (manifest, icons, service worker, offline page), sitemap (excludes sample/draft), robots, OG images, Organization/Product JSON-LD, 8 policy pages, contact form, 404/error pages, instrumentation hook.

## Test results (latest)
- Vitest: **38/38** (pricing, coupons, GST, transitions, rupees-in-words, SQL repricing = JS pricing, concurrent stock decrement with no oversell).
- Playwright: **93/93** — full journey on iPhone 14, Pixel 7, desktop + axe (no serious/critical) on 10 storefront pages × dark/light + 4 admin pages. Re-run on the final code (after all performance changes): 93/93 passing.
- Importer verified via API: 250-row file (4 planted errors caught), bulk update, export→re-import = 0 changes, delete-by-SKU.
- Lighthouse mobile (median of 3, simulated slow 4G, localhost prod build): Home 91, Shop 91, Collection 91, FAQ 95, Product 96 (one outlier run per page at ~84–85). Accessibility 95–97, Best Practices 100, SEO 100.

## Change: direct UPI payments + sub-₹1 lakh catalogue ✅ (2026-10-07)
- **Razorpay removed entirely** (code, package, CSP, env vars, policy copy). Payment methods: **UPI** (default, no fees) and Cash on Delivery (admin toggle).
- Own payment page `/checkout/pay/[order]`: amount, reservation countdown, QR (desktop), Google Pay / PhonePe / Paytm / any-UPI buttons (mobile), copyable UPI ID, "Payment done? Enter UTR" prompt that opens automatically when the customer returns from their UPI app, optional payer UPI ID + screenshot, "Payment verification pending" state that polls for confirmation.
- New order status `PAYMENT_SUBMITTED`; stock reserved at order placement; unpaid orders auto-cancel after the configurable window (stock + coupon released); orders awaiting review never auto-cancel.
- Admin → **Payments**: To verify (UTR, amount, payer, screenshot → Confirm / Reject with reason), Refunds to send (manual, with transfer reference), Awaiting payment, Reviewed. Dashboard counter + store email alert per UTR. UTR unique across all orders; "Paid" only via UTR confirmation; all actions audited.
- Settings: store UPI ID, payee name, stock-hold minutes. Dev uses a non-routable placeholder (`your-upi-id@bank`) with a warning; production keeps UPI off until a real UPI ID is set.
- Sample catalogue repriced to ₹9,999–₹99,000 MRP (materials/copy adjusted), price filters and coupons (`WELCOME10` max ₹5,000, `FLAT2000` over ₹50,000) updated.
- Tests: Vitest **47/47** (adds UPI helpers + DB-backed UTR rules: duplicate UTR, reject→resubmit→confirm, expiry releases stock/coupon, owner-only). Playwright **96/96** (journey now pays by UPI and admin confirms the UTR).

## Change: Cash on Delivery removed ✅ (2026-10-07)
- UPI is the only payment method. Removed the COD option, COD fee/limit settings, PIN-zone COD flags, COD invoice/packing-slip wording and policy/FAQ copy; migration `remove_cod` drops the COD enum value and columns (no COD orders existed).
- Vitest 47/47, typecheck + lint clean. **E2E not re-run (by request) — run `npm run test:e2e` after the next batch of changes.**

## In progress / next
- ✅ Blanche 36 cover crop fixed; ✅ README.md and .env.example written; ✅ E2E re-run green.
- Set the store UPI ID in Admin → Settings.
- Deploy to Vercel once credentials are provided (Neon, Resend, Cloudinary, Google, Vercel login); smoke-test live URL.

## Tests
- Vitest unit: 28 passing (pricing, coupons, GST totals, order transitions, rupees-in-words).

## Change: own dataset import + light theme + test accounts ✅ (2026-10-08)
- Light ("ivory") theme is the default; dark stays available.
- Importer reads the dataset CSV as-is (watch_id, model_name, collection, watch_type, case_size_mm, strap, water_resistance, warranty, price_inr, image1–4, rating, rating_count…). Ignored: segment, image_count, dataset_image_file.
- Images are **links** (never downloaded); shown straight from their host with no-referrer, on white, with a placeholder if a link dies. Link check runs in the admin's browser (servers get blocked by retail CDNs); broken links are dropped at commit.
- Normalisation: watch types → Analog / Chronograph / Multifunction / Smartwatch / Diver…; "Rechargeable battery" → Smart; placeholder model numbers ("…xxx (variant TBC)") → SKU; duplicate brand+reference caught at preview.
- Shop filters: Type, Movement (only those in stock), Strap type, Case shape. PDP spec table shows collection, type, functions, case shape, brand origin and a highlight line.
- `top246_watches_final.csv` imported: 246 watches, 0 failures (11 dead image links of 881 dropped).
- Dev-only one-click sign-in on /sign-in: customer@maison.test and admin@maison.test (seeded, no OTP).
- Vitest 53/53, typecheck + lint clean. E2E not re-run (by request).
