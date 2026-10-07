import { BottomNav } from "@/components/layout/bottom-nav";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { PreviewBanner } from "@/components/layout/preview-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { getSettings } from "@/server/settings";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  return (
    <>
      <PreviewBanner />
      <SiteHeader />
      <main id="main" className="min-h-[60dvh]">{children}</main>
      <SiteFooter />
      <BottomNav />
      <WhatsAppButton number={settings.whatsappNumber} />
      {/* E2E shows it at once so tests can exercise and dismiss it. */}
      <CookieConsent delayMs={process.env.E2E_TEST_MODE === "1" ? 0 : 30_000} />
    </>
  );
}
