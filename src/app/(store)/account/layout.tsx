import { requireUser } from "@/lib/session";
import { AccountNav } from "./account-nav";

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await requireUser("/account");
  return (
    <div className="container-luxe py-8 md:py-12">
      <p className="eyebrow text-gold">My account</p>
      <h1 className="mt-2 text-4xl md:text-5xl">Hello{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_1fr] lg:gap-16">
        <AccountNav isAdmin={user.role === "ADMIN"} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
