"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Runs a server action, toasts the result and refreshes. */
export function ActionButton({ action, confirmText, children, ...props }: Omit<ComponentProps<typeof Button>, "onClick" | "action"> & {
  action: () => Promise<{ ok: boolean; error?: string; message?: string }>;
  confirmText?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button {...props} loading={pending} onClick={() => {
      if (confirmText && !confirm(confirmText)) return;
      start(async () => { const r = await action(); if (r.ok) { toast.success(r.message ?? "Done"); router.refresh(); } else toast.error(r.error); });
    }}>{children}</Button>
  );
}
