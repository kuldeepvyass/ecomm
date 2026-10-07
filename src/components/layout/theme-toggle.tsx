"use client";

import { Moon, Sun } from "lucide-react";
import { KEYS } from "@/lib/client/storage";
import { cn } from "@/lib/utils";

/** Inline script (in <head>) applies the saved theme before paint; this flips it. */
export const themeScript = `try{var d=document.documentElement,t=localStorage.getItem("${KEYS.theme}");if(t==="light"||t==="dark")d.dataset.theme=t;var c=localStorage.getItem("${KEYS.consent}");if(c)d.dataset.consent=c}catch(e){}`;

export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEYS.theme, next);
    } catch {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#faf7f2" : "#0b0a09");
  }
  return (
    <button type="button" onClick={toggle} aria-label="Switch between dark and ivory theme"
      className={cn("grid size-11 place-items-center rounded-full text-fg-muted transition-colors hover:text-gold", className)}>
      <Sun className="hidden size-5 [[data-theme=dark]_&]:block" aria-hidden />
      <Moon className="hidden size-5 [[data-theme=light]_&]:block" aria-hidden />
    </button>
  );
}
