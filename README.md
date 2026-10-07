# Maison Horlogère

A mobile-first luxury watch store for India: Next.js 16 (App Router) · TypeScript · Tailwind 4 · Framer Motion ·
Prisma 7 + PostgreSQL · Auth.js v5 (email OTP / magic link + Google) · direct UPI payments (no gateway, no fees) · Cloudinary · Resend.

See `PROGRESS.md` for what's built and the latest test results, and `design-system/MASTER.md` for the design tokens.

---

## 1. Run it locally

Requirements: Node 20.9+ (24 recommended), PostgreSQL 15+.

```bash
npm install
cp .env.example .env        # fill DATABASE_URL, DIRECT_URL, AUTH_SECRET, AUTH_URL, NEXT_PUBLIC_SITE_URL, ADMIN_EMAILS
npm run db:deploy           # apply migrations
npm run db:seed             # settings, shipping zones, coupons, collections + 20 sample watches
npm run dev -- -p 3100      # http://localhost:3100 (on your phone: http://<your-mac-ip>:3100, same Wi-Fi)
```

On this machine Postgres runs from the project folder on port 5433:

```bash
LC_ALL=en_US.UTF-8 /opt/homebrew/opt/postgresql@17/bin/pg_ctl -D .pgdata -l .pgdata/server.log -o "-p 5433 -k /tmp" start
```

**Without third-party keys the app still works end-to-end in development:**

| Service missing | What happens instead |
|---|---|
| Resend | Emails (sign-in codes, order updates) are saved locally — open **/dev/mail** |
| Store UPI ID | In development the payment page uses a placeholder UPI ID (`your-upi-id@bank`, not a real handle) and shows a warning. In production UPI checkout stays off until you set your UPI ID |
| Cloudinary | Uploads are saved to `public/uploads` (production requires Cloudinary) |
| Google | The Google button is hidden |

### Signing in as admin
1. Put your email in `ADMIN_EMAILS` (comma-separated for several).
2. Go to `/sign-in`, enter that email, and use the 6-digit code from the email (or `/dev/mail` locally).
3. Open **/admin**. Admin access is enforced on the server for every page and action.

---

## 2. Importing your catalogue

Admin → **Import / Export**.

1. Download the **template** (.xlsx has an *Instructions* sheet describing every column; .csv also available).
2. Fill one row per watch. Required for new products: `sku, brand, modelName, referenceNumber, description, mrp, stock, gender, caseMaterial, caseDiameterMm, dialColour, strapMaterial, movement`.
   - `mrp` is the GST-inclusive MRP in whole rupees. **Selling prices are always calculated by the store** from the discount rules.
   - `collections`: pipe-separated, e.g. `Dive|Limited Edition` (created if new).
   - `images`: pipe-separated, in display order — public URLs and/or file names inside a ZIP you upload alongside.
   - `externalRating / externalRatingCount / externalRatingSource`: only real ratings copied from a named source (e.g. `4.6 / 1240 / Amazon.in`). Leave blank to show nothing.
3. Choose the mode:
   - **Import** — creates new SKUs and updates existing ones.
   - **Bulk update** — matches on `sku` and changes only the columns you fill (e.g. a sheet with just `sku, mrp, stock`).
   - **Remove / deactivate** — upload a sheet or paste SKUs; move to trash (restorable) or hide as drafts.
4. **Validate & preview** shows every row as create / update / skip / error with reasons. Nothing changes until you **Confirm**.
5. Results (created / updated / skipped / failed) are kept in **History**. **Export catalog** produces the same template format, so you can edit in Excel and re-upload.

Tested with 250 rows (≈2 s when image URLs are already known).

**Remove the sample data** when you're ready: Admin → Settings → *Delete all sample data* (type the confirmation phrase). The "Preview mode" banner disappears automatically.

---

## 3. Setting the discount

Admin → **Pricing**.

- **Global discount %** (e.g. 2, 5, 7.5) applies to every product: `selling price = MRP × (1 − discount%)`, rounded to the nearest rupee.
- Click **Preview** to see every price change (e.g. `₹10,00,000 → ₹9,50,000`), then **Apply to all products**. Prices update across the site within seconds and the change is logged (who, when, old → new).
- On a product's edit page you can set an **own discount %** (wins over the global one) or tick **Exclude from global discount**.
- Coupons (percent or flat, minimum order, dates, usage limits) live under Admin → **Coupons**.

---

## 4. Payments — direct UPI, verified by UTR

There is no payment gateway and no fee. The customer pays **your UPI ID** directly; you confirm each payment by its UTR.

**Set up (once):** Admin → Settings → *UPI payments*
- **Store UPI ID** — use a business/merchant UPI ID (your bank's merchant UPI, PhonePe Business, Paytm for Business, BharatPe…). These are free for UPI, show the payer's note, and send you instant "payment received" alerts, which makes checking UTRs quick. Personal UPI IDs work but some apps limit or flag business payments to them.
- **Payee name** — what the customer sees in their UPI app.
- **Hold stock for** — minutes an unpaid order keeps the watch reserved (default 30).

**How a UPI order flows**
1. Checkout → *Continue to pay*. The order is created and the watch is **reserved**.
2. Our payment page shows the amount, a countdown, a **QR code** (desktop) and **Google Pay / PhonePe / Paytm / other UPI app** buttons (mobile). The amount and the note `Order MH-…` are pre-filled.
3. A website can't read the result from a UPI app, so when the customer returns we ask for the **12-digit UTR** (with help on where to find it). A screenshot and their UPI ID are optional.
4. The order shows **"Payment verification pending"**; the customer and your store email are notified.
5. **Admin → Payments → To verify**: find the UTR and amount in your bank / UPI business app, then
   - **Confirm payment received** → order becomes *Paid*, GST invoice issued, customer emailed; or
   - **Reject** with a reason → customer is emailed and can submit a corrected UTR (the reservation is extended).
6. Orders with no UTR before the deadline are cancelled automatically and the watch (and any coupon) is released. Orders with a submitted UTR are never auto-cancelled — they wait for you.

**Safeguards:** each UTR can be used only once across all orders; the amount shown to you is the exact order total; "Paid" can only be set by confirming a UTR (not from the status dropdown); every confirm/reject is in the audit log.

**Refunds:** send the money back by UPI/bank transfer, then record it on the order (or *Payments → Refunds to send*) with the transfer reference. Customer cancellations after paying appear there automatically.

UPI is the only payment method — there is no Cash on Delivery or card option.

---

## 5. Deploying to Vercel

1. Create a Neon (or Supabase) Postgres database; copy the pooled and direct connection strings.
2. Push this folder to GitHub and import it in Vercel (framework: Next.js; build command `npm run build`).
3. Add every variable from `.env.example` for *Production* (and *Preview* if you use it). After deploying, set your UPI ID in Admin → Settings.
4. Run migrations and seed once against the production DB from your machine:
   ```bash
   DATABASE_URL="…direct url…" DIRECT_URL="…direct url…" npx prisma migrate deploy
   DATABASE_URL="…" npx prisma db seed            # SEED_DEMO=0 to skip the sample watches
   ```
5. Deploy, sign in with an `ADMIN_EMAILS` address, and set store details in Admin → Settings.

### Custom domain
Vercel → Project → *Settings → Domains* → add `your-domain.com` (and `www`), then create the DNS records Vercel shows at your registrar.
Update `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, the Google OAuth redirect URI, and verify the domain in Resend (for `EMAIL_FROM`). Redeploy.

---

## 6. Tests

```bash
npm test            # Vitest: pricing, coupons, GST totals, order transitions, UPI/UTR rules, SQL repricing, concurrent stock
npm run test:e2e    # Playwright on iPhone 14, Pixel 7, desktop + axe accessibility (uses a separate maison_e2e DB)
npm run lighthouse  # Lighthouse CI, mobile, 5 key pages
npm run typecheck && npm run lint
```

## 7. Monitoring
Server errors are logged as structured JSON (visible in Vercel → Logs) via `src/instrumentation.ts`.
To add Sentry: `npx @sentry/wizard@latest -i nextjs`, set `SENTRY_DSN`, and call `Sentry.captureRequestError` inside `onRequestError`.
