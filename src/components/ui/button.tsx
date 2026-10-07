import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-sans font-medium uppercase tracking-[0.16em] transition-[background-color,color,border-color,transform,opacity] duration-200 ease-[var(--ease-luxe)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-gold text-on-gold hover:bg-gold-strong",
        solid: "bg-fg text-bg hover:opacity-90",
        outline: "border border-border-strong text-fg hover:border-gold hover:text-gold",
        ghost: "text-fg hover:bg-surface-2",
        link: "h-auto px-0 text-gold underline underline-offset-4 hover:decoration-2 active:scale-100",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-10 px-4 text-[0.6875rem]",
        md: "h-12 px-6 text-xs",
        lg: "h-14 px-8 text-xs",
        icon: "size-11 tracking-normal",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export function Button({ className, variant, size, block, asChild, loading, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), "rounded-[2px]", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
