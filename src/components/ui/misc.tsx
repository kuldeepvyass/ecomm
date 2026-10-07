import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("skeleton rounded-[2px]", className)} {...props} />;
}

export function Badge({ children, tone = "neutral", className }: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "danger" | "success" | "outline";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-3 text-fg",
    gold: "bg-gold text-on-gold",
    danger: "bg-danger text-white",
    success: "bg-success/15 text-success",
    outline: "border border-border-strong text-fg-muted",
  };
  return (
    <span className={cn("inline-flex h-6 items-center rounded-[2px] px-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em]", tones[tone], className)}>
      {children}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, description, action, className, as: Tag = "h2" }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3 text-gold">{eyebrow}</p>}
        <Tag className="text-4xl md:text-5xl">{title}</Tag>
        {description && <p className="mt-3 text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
      {icon && <div className="text-gold [&_svg]:size-10" aria-hidden>{icon}</div>}
      <h2 className="text-3xl">{title}</h2>
      {description && <p className="max-w-md text-fg-muted">{description}</p>}
      {action}
    </div>
  );
}
