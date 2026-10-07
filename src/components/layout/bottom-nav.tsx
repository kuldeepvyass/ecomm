"use client";

import { Heart, Home, Search, Store, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/components/providers";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/watches", label: "Shop", icon: Store, match: (p: string) => p.startsWith("/watches") || p.startsWith("/collections") || p.startsWith("/brands") },
  { href: "/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/search") },
  { href: "/wishlist", label: "Wishlist", icon: Heart, match: (p: string) => p.startsWith("/wishlist") },
  { href: "/account", label: "Profile", icon: User, match: (p: string) => p.startsWith("/account") || p.startsWith("/sign-in") },
] as const;

/** Mobile-only sticky tab bar (≤5 items per the UX rules). Hidden on checkout to keep focus. */
export function BottomNav() {
  const pathname = usePathname();
  const { wishlist, user } = useStore();
  if (pathname.startsWith("/checkout") || pathname.startsWith("/admin")) return null;

  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/92 pb-safe backdrop-blur-md md:hidden" data-bottom-nav>
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          const target = href === "/account" && !user ? "/sign-in" : href;
          return (
            <li key={href}>
              <Link href={target} aria-current={active ? "page" : undefined}
                className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[0.625rem] uppercase tracking-[0.14em] transition-colors",
                  active ? "text-gold" : "text-fg-muted")}>
                <Icon className="size-5" strokeWidth={active ? 2 : 1.5} aria-hidden />
                {label}
                {href === "/wishlist" && wishlist.size > 0 && (
                  <span className="absolute right-[calc(50%-1.1rem)] top-2.5 size-1.5 rounded-full bg-gold" aria-hidden />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
