import type { Metadata } from "next";
import { ArrowRight, Heart, MapPin, Package } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const [me, orders, addresses, wishlist] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, phone: true } }),
    db.order.count({ where: { userId: user.id } }),
    db.address.count({ where: { userId: user.id } }),
    db.wishlistItem.count({ where: { userId: user.id } }),
  ]);
  const tiles = [
    { href: "/account/orders", label: "Orders", value: orders, icon: Package },
    { href: "/account/addresses", label: "Addresses", value: addresses, icon: MapPin },
    { href: "/wishlist", label: "Wishlist", value: wishlist, icon: Heart },
  ];
  return (
    <div className="flex flex-col gap-12">
      <ul className="grid grid-cols-3 gap-3">
        {tiles.map(({ href, label, value, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex flex-col gap-2 border border-border p-4 transition-colors hover:border-gold md:p-6">
              <Icon className="size-5 text-gold" aria-hidden />
              <span className="font-display text-3xl">{value}</span>
              <span className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-fg-muted">{label} <ArrowRight className="hidden size-4 md:block" aria-hidden /></span>
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="mb-6 text-3xl">Personal details</h2>
        <ProfileForm name={me.name ?? ""} phone={me.phone ?? ""} email={me.email} />
      </section>
    </div>
  );
}
