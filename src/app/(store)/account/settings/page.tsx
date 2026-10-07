import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const user = await requireUser("/account/settings");
  const prefs = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { notifyMarketing: true, notifyBackInStock: true } });
  return <SettingsView prefs={prefs} />;
}
