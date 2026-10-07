"use client";

import { usePathname } from "next/navigation";

export function WhatsAppButton({ number }: { number: string | null }) {
  const pathname = usePathname();
  if (!number || pathname.startsWith("/checkout") || pathname.startsWith("/admin")) return null;
  const digits = number.replace(/\D/g, "");
  const text = encodeURIComponent("Hello, I'd like help choosing a watch.");
  return (
    <a href={`https://wa.me/${digits}?text=${text}`} target="_blank" rel="noopener noreferrer" aria-label="Chat with a watch specialist on WhatsApp"
      className="fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-luxe transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6">
      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.81-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.21 4.24-9.45 9.46-9.45 2.53 0 4.9.99 6.69 2.78a9.4 9.4 0 0 1 2.77 6.69c0 5.21-4.24 9.45-9.45 9.45zm8.04-17.49A11.3 11.3 0 0 0 12.04.7C5.77.7.67 5.8.67 12.07c0 2 .52 3.96 1.52 5.69L.57 23.7l6.08-1.6a11.33 11.33 0 0 0 5.39 1.37h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.89-3.34-8.04z" />
      </svg>
    </a>
  );
}
