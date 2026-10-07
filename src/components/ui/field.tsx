import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-[2px] border border-border bg-surface px-4 text-fg placeholder:text-fg-subtle transition-colors duration-200 hover:border-border-strong focus:border-gold focus:outline-none aria-[invalid=true]:border-danger disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-12 appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a39e95' fill='none' stroke-width='1.5'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
}

/** Label + control + helper/error, with the error announced next to the field. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
  required,
}: {
  label: string;
  error?: string | string[];
  hint?: ReactNode;
  className?: string;
  required?: boolean;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const msg = Array.isArray(error) ? error[0] : error;
  const describedBy = msg ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="eyebrow text-fg-muted">
        {label}
        {required && <span className="text-gold" aria-hidden> *</span>}
      </label>
      {children({ id, "aria-invalid": msg ? true : undefined, "aria-describedby": describedBy })}
      {msg ? (
        <p id={`${id}-err`} role="alert" className="text-sm text-danger">{msg}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex min-h-11 items-center gap-3 text-sm", className)}>
      <input type="checkbox" className="size-5 shrink-0 accent-[var(--gold)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
