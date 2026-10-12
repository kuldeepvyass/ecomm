# Maison Horlogère

A mobile-first luxury watch store for India: Next.js 16 (App Router) · TypeScript · Tailwind 4 · Framer Motion ·
Prisma 7 + PostgreSQL · Auth.js v5 (email OTP / magic link + Google) · direct UPI payments (no gateway, no fees) · Cloudinary · Resend.

See `PROGRESS.md` for what's built and the latest test results, and `design-system/MASTER.md` for the design tokens.

---

## 1. Run it locally

On a Mac, one command sets everything up (Node 24 + PostgreSQL 17 via Homebrew, local databases, `.env`,
packages, migrations and the store's 246-watch catalogue from `prisma/data/catalog.json`):

```bash
./scripts/setup-local.sh you@example.com   # your admin email (or leave it out to be asked)
npm run dev -- -p 3100                      # http://localhost:3100 (phone on the same Wi-Fi: http://<your-mac-ip>:3100)
```

After restarting the Mac: `npm run db:start`. Sign in with your admin email at `/sign-in` — locally the 6-digit code
appears at `/dev/mail`.

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

## 5. Deploying to a Hostinger VPS (`./deploy.sh`)

Everything runs on your own VPS: Node.js 24 app (systemd), Nginx with free HTTPS (Let's Encrypt), PostgreSQL 17
with nightly backups, firewall, fail2ban and automatic security updates. Rehearsed end to end (first deploy, redeploy,
rollback, backup, copy-catalog, root and sudo users) against a fresh Ubuntu 24.04 server.

**Before deployment day**
1. Hostinger VPS with **Ubuntu 22.04 or 24.04** (KVM 1 or bigger). Note its IP and root password (or add your SSH key in hPanel).
2. Domain DNS → **A record `@`** and **A record `www`** pointing to the VPS IP.
3. A mailbox for sending (hPanel → Emails), e.g. `orders@your-domain.com`.

**Deploy**
```bash
cp .env.production.example .env.production   # then fill it in (comments explain every line)
./deploy.sh
```
The first run sets up the server (~5–10 min); later runs only ship new code (~3–4 min). `AUTH_SECRET` and the
database password are generated for you and saved back into `.env.production` — keep that file safe (it's git-ignored).

How a deploy works: quick local checks (typecheck, lint, unit tests) → code uploaded to a new `releases/<timestamp>`
folder → packages installed, migrations applied and the app built **on the server** while the current version keeps
serving → the `current` link switches and the service restarts (≈1 s) → health check on `/api/health`; if it fails,
the previous release is restored automatically. The last 3 releases are kept.

| Command | What it does |
|---|---|
| `./deploy.sh` | Deploy (first run also sets up the server) |
| `./deploy.sh setup` | Re-run server setup — e.g. after DNS starts pointing at the VPS, to switch on HTTPS |
| `./deploy.sh copy-catalog` | Copy products, brands, collections and banners from your local database (only into an empty live store) |
| `./deploy.sh rollback` | Switch back to the previous release |
| `./deploy.sh status` / `logs` / `ssh` | Service status, live logs, a shell on the server |
| `./deploy.sh backup` | Back up the live database now and download it to `./backups/` |
| `--skip-checks` | Skip the local typecheck/lint/unit tests |

**After the first deploy:** the store already has the catalogue from `prisma/data/catalog.json` (refresh it with
`npm run catalog:export` before deploying if you changed products locally). Sign in with an `ADMIN_EMAILS` address →
Admin → Settings: store details, GSTIN and your **UPI ID** (payments stay off until it's set).

**On the server:** app in `/var/www/maison/current`, settings in `/var/www/maison/shared/.env` (regenerated from
`.env.production` on every deploy), uploaded images in `/var/www/maison/shared/media`, database backups in
`/var/www/maison/shared/backups` (14 days).

---

## 6. Tests

```bash
npm test            # Vitest: pricing, coupons, GST totals, order transitions, UPI/UTR rules, SQL repricing, concurrent stock
npm run test:e2e    # Playwright on iPhone 14, Pixel 7, desktop + axe accessibility (uses a separate maison_e2e DB)
npm run lighthouse  # Lighthouse CI, mobile, 5 key pages
npm run typecheck && npm run lint
```

## 7. Monitoring
Server errors are logged as structured JSON (`./deploy.sh logs`, i.e. `journalctl -u maison`) via `src/instrumentation.ts`. Uptime monitors can poll `https://your-domain/api/health`.
To add Sentry: `npx @sentry/wizard@latest -i nextjs`, set `SENTRY_DSN`, and call `Sentry.captureRequestError` inside `onRequestError`.
