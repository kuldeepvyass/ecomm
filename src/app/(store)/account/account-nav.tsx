"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/account/reviews", label: "My reviews" },
  { href: "/account/settings", label: "Settings" },
];

export function AccountNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="-mx-5 overflow-x-auto px-5 no-scrollbar lg:mx-0 lg:px-0">
      <ul className="flex gap-2 lg:flex-col lg:gap-0">
        {LINKS.map((l) => {
          const active = l.href === "/account" ? pathname === "/account" : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link href={l.href} aria-current={active ? "page" : undefined}
                className={cn("flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors lg:rounded-none lg:border-0 lg:border-l-2 lg:px-4",
                  active ? "border-gold text-gold" : "border-border text-fg-muted hover:text-fg lg:border-transparent")}>
                {l.label}
              </Link>
            </li>
          );
        })}
        {isAdmin && (
          <li><Link href="/admin" className="flex min-h-11 items-center whitespace-nowrap rounded-full border border-gold/50 px-4 text-sm text-gold lg:rounded-none lg:border-0 lg:border-l-2 lg:border-transparent">Admin panel</Link></li>
        )}
        <li>
          <form action={signOutAction}>
            <button type="submit" className="flex min-h-11 items-center whitespace-nowrap rounded-full border border-border px-4 text-sm text-fg-muted hover:text-danger lg:rounded-none lg:border-0 lg:px-4">Sign out</button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
