"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bottom sheet on mobile, side drawer from `md` up. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "left";
  trigger?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-[fade-in_200ms_ease-out] data-[state=closed]:animate-[fade-out_150ms_ease-in]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface text-fg shadow-luxe outline-none",
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl border-t border-border pb-safe",
            "data-[state=open]:animate-[sheet-up_320ms_var(--ease-luxe)] data-[state=closed]:animate-[sheet-down_200ms_var(--ease-exit)]",
            "md:inset-y-0 md:bottom-auto md:h-dvh md:max-h-none md:w-[26rem] md:rounded-none md:border-t-0",
            side === "right"
              ? "md:left-auto md:right-0 md:border-l md:data-[state=open]:animate-[drawer-in-right_320ms_var(--ease-luxe)] md:data-[state=closed]:animate-[drawer-out-right_200ms_var(--ease-exit)]"
              : "md:left-0 md:right-auto md:border-r md:data-[state=open]:animate-[drawer-in-left_320ms_var(--ease-luxe)] md:data-[state=closed]:animate-[drawer-out-left_200ms_var(--ease-exit)]",
          )}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border-strong md:hidden" aria-hidden />
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-2xl">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-fg-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="grid size-11 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="size-5" />
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer && <footer className="border-t border-border px-5 py-4">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
