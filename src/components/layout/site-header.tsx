"use client";

import { Heart, Menu, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/logo";
import { useStore } from "@/components/providers";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, SERVICE_LINKS } from "./nav-links";
import { GetAppButton } from "./get-app";
import { ThemeToggle } from "./theme-toggle";

// Loaded on first open — keeps Radix Dialog out of the initial bundle.
const Sheet = dynamic(() => import("@/components/ui/sheet").then((m) => m.Sheet), { ssr: false });
const SearchDialog = dynamic(() => import("./search-dialog").then((m) => m.SearchDialog), { ssr: false });

function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute right-1 top-1 grid min-w-[1.125rem] place-items-center rounded-full bg-gold px-1 text-[0.625rem] font-semibold leading-[1.125rem] text-on-gold" aria-hidden>
      {n > 9 ? "9+" : n}
    </span>
  );
}

const iconBtn = "relative grid size-11 place-items-center rounded-full text-fg transition-colors hover:text-gold";

export function SiteHeader() {
  const { cartCount, wishlist, user } = useStore();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuUsed, setMenuUsed] = useState(false);
  const [searchUsed, setSearchUsed] = useState(false);
  const overHero = pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchUsed(true);
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      // Over the dark hero photo the header borrows the dark palette so its text stays legible.
      data-theme={overHero ? "dark" : undefined}
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300",
        overHero ? "border-b border-transparent bg-transparent" : "border-b border-border bg-bg/85 backdrop-blur-md",
      )}
    >
      <div className="container-luxe flex h-16 items-center justify-between gap-2 md:h-20">
        <div className="flex flex-1 items-center gap-1">
          <button type="button" className={cn(iconBtn, "xl:hidden")} aria-label="Open menu" onClick={() => { setMenuUsed(true); setMenuOpen(true); }}>
            <Menu className="size-5" aria-hidden />
          </button>
          <nav aria-label="Primary" className="hidden xl:block">
            <ul className="flex items-center gap-6">
              {PRIMARY_NAV.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="eyebrow whitespace-nowrap text-fg-muted transition-colors hover:text-gold">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Link href="/" aria-label="Maison Horlogère — home" className="shrink-0">
          <Wordmark compact />
        </Link>

        <div className="flex flex-1 items-center justify-end gap-0.5">
          <GetAppButton className="mr-1" />
          <button type="button" className={cn(iconBtn, "hidden md:grid")} aria-label="Search (⌘K)" onClick={() => { setSearchUsed(true); setSearchOpen(true); }}>
            <Search className="size-5" aria-hidden />
          </button>
          <ThemeToggle className="hidden md:grid" />
          <Link href={user ? "/account" : "/sign-in"} className={cn(iconBtn, "hidden md:grid")} aria-label={user ? "Your account" : "Sign in"}>
            <User className="size-5" aria-hidden />
          </Link>
          <Link href="/wishlist" className={cn(iconBtn, "hidden md:grid")} aria-label={`Wishlist, ${wishlist.size} items`}>
            <Heart className="size-5" aria-hidden />
            <CountBadge n={wishlist.size} />
          </Link>
          <Link href="/bag" className={iconBtn} aria-label={`Shopping bag, ${cartCount} items`} data-testid="header-bag">
            <ShoppingBag className="size-5" aria-hidden />
            <CountBadge n={cartCount} />
          </Link>
        </div>
      </div>

      {menuUsed && <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu" side="left">
        <nav aria-label="Mobile">
          <ul className="flex flex-col">
            {PRIMARY_NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setMenuOpen(false)} className="flex min-h-14 items-center border-b border-border font-display text-2xl">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-6 flex flex-col">
            {SERVICE_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center text-sm text-fg-muted hover:text-gold">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-fg-muted">Theme</span>
            <ThemeToggle />
          </div>
        </nav>
      </Sheet>}
      {searchUsed && <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />}
    </header>
  );
}
