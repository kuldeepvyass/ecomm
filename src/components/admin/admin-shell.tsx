"use client";

import { BarChart3, ClipboardList, FileClock, Images, IndianRupee, LayoutDashboard, Menu, Percent, Settings, Star, Store, Tag, Upload, Users, Watch } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Monogram } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/payments", label: "Payments", icon: IndianRupee },
  { href: "/admin/products", label: "Products", icon: Watch },
  { href: "/admin/products/import", label: "Import / Export", icon: Upload },
  { href: "/admin/pricing", label: "Pricing", icon: Percent },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/content", label: "Homepage", icon: Images },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit log", icon: FileClock },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeHref = [...ADMIN_NAV].sort((a, b) => b.href.length - a.href.length).find((n) => (n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href)))?.href;
  return (
    <ul className="flex flex-col gap-0.5">
      {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link href={href} onClick={onNavigate} aria-current={activeHref === href ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-3 rounded-[2px] px-3 text-sm transition-colors", activeHref === href ? "bg-gold-soft text-gold" : "text-fg-muted hover:bg-surface-2 hover:text-fg")}>
            <Icon className="size-4" aria-hidden /> {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AdminShell({ user, children }: { user: { name: string; email: string }; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface p-4 lg:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2 px-2"><Monogram className="text-gold" /><span className="font-display text-lg tracking-[0.14em]">ADMIN</span></Link>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto"><NavList /></nav>
        <div className="border-t border-border pt-3 text-xs text-fg-muted">
          <p className="truncate">{user.email}</p>
          <div className="mt-2 flex items-center justify-between">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 hover:text-gold"><Store className="size-4" aria-hidden /> View store</Link>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="grid size-11 place-items-center" aria-label="Open admin menu"><Menu className="size-5" aria-hidden /></button>
          <span className="flex items-center gap-2 font-display tracking-[0.14em]"><BarChart3 className="size-4 text-gold" aria-hidden /> ADMIN</span>
          <Link href="/" className="grid size-11 place-items-center" aria-label="View store"><Store className="size-5" aria-hidden /></Link>
        </header>
        <Sheet open={open} onOpenChange={setOpen} title="Admin" side="left"><nav aria-label="Admin mobile"><NavList onNavigate={() => setOpen(false)} /></nav></Sheet>
        <main id="main" className="px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
