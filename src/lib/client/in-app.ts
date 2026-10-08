/**
 * Is the site running inside our Android app? Works with any "website → APK" converter:
 * - Android WebView user agents carry "; wv)" (Chrome itself never does);
 * - TWA / installed-PWA wrappers run in standalone display mode or arrive via android-app:// referrer;
 * - backup marker: give the converter the start URL https://<domain>/?source=app.
 * (In-app browsers like Instagram's are WebViews too; hiding the download button there is fine.)
 */
const FLAG = "mh.in-app";

export function isInApp(): boolean {
  try {
    if (sessionStorage.getItem(FLAG) === "1") return true;
    if (new URLSearchParams(location.search).get("source") === "app") {
      sessionStorage.setItem(FLAG, "1");
      return true;
    }
  } catch {}
  if (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches) return true;
  if (document.referrer.startsWith("android-app://")) return true;
  return /Android.*;\s*wv\)/i.test(navigator.userAgent);
}

/** APKs only install on Android; iPhones/iPads never see the download. */
export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export type ClientKind = "app" | "ios" | "android" | "desktop";

export function clientKind(): ClientKind {
  return isInApp() ? "app" : isIOS() ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "desktop";
}
