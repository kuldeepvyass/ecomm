import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { readSettings } from "@/server/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function Settings() {
  await requireAdmin();
  const [s, demo] = await Promise.all([
    readSettings(),
    Promise.all([db.product.count({ where: { isDemo: true, deletedAt: null } }), db.review.count({ where: { isDemo: true } })]),
  ]);
  const services = [
    ["Database", true],
    ["Email (Resend)", Boolean(process.env.RESEND_API_KEY)],
    ["UPI ID for payments", Boolean(s.upiVpa)],
    ["Images (Cloudinary)", Boolean(process.env.CLOUDINARY_CLOUD_NAME)],
    ["Google sign-in", Boolean(process.env.AUTH_GOOGLE_ID)],
    ["Error tracking (Sentry)", Boolean(process.env.SENTRY_DSN)],
  ] as const;
  return (
    <div>
      <PageHeader title="Store settings" />
      <section className="mb-10 border border-border p-4">
        <h2 className="mb-3 text-xl">Connected services</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {services.map(([name, on]) => <li key={name} className="flex items-center gap-2"><span className={on ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-warning"} aria-hidden />{name}: <span className={on ? "text-success" : "text-warning"}>{on ? "connected" : "not configured"}</span></li>)}
        </ul>
      </section>
      <SettingsForm initial={s} demo={{ products: demo[0], reviews: demo[1] }} />
    </div>
  );
}
