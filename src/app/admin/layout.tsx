import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

/** Server-side guard; every admin action re-checks with assertAdmin(). */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return <AdminShell user={{ name: user.name ?? user.email ?? "Admin", email: user.email ?? "" }}>{children}</AdminShell>;
}
