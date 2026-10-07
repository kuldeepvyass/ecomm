"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { SearchPanel } from "@/components/search/search-panel";

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content className="fixed inset-x-0 top-0 z-50 max-h-dvh overflow-y-auto border-b border-border bg-bg py-8 shadow-luxe data-[state=open]:animate-[fade-up_300ms_var(--ease-luxe)]">
          <div className="container-luxe max-w-3xl">
            <div className="mb-6 flex items-center justify-between">
              <Dialog.Title className="font-display text-3xl">Search</Dialog.Title>
              <Dialog.Description className="sr-only">Search the collection by brand, model or reference number</Dialog.Description>
              <Dialog.Close className="grid size-11 place-items-center rounded-full text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Close search">
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
            {open && <SearchPanel onNavigate={() => onOpenChange(false)} />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
