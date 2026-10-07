"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import { LINKED_IMAGE_PROPS, cdnLoader, isLinkedImage, sameOriginLoader } from "@/lib/image-loader";
import { cn } from "@/lib/utils";

type Props = Omit<ImageProps, "loader" | "placeholder" | "blurDataURL" | "priority"> & {
  blurDataUrl?: string | null;
  /** Above-the-fold / LCP candidate. Next 16 deprecated `priority`; this maps to eager + high fetch priority. */
  priority?: boolean;
};

/**
 * Non-priority images mount only when within ~300px of the viewport. Browsers widen their native
 * lazy-load margin on slow connections (fetching most of a page up front); this keeps the LCP image
 * from competing for bandwidth. The blur placeholder occupies the same box, so there is no layout shift.
 */
export function WatchImage({ blurDataUrl, priority, fill, className, ...props }: Props) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(Boolean(priority));
  const [broken, setBroken] = useState(false);
  const linked = isLinkedImage(props.src);

  useEffect(() => {
    if (visible) return;
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  if (!visible) {
    return (
      <span
        ref={anchor}
        aria-hidden
        className={cn(fill ? "absolute inset-0 block bg-surface-2 bg-cover bg-center" : "block bg-surface-2", className)}
        style={{ backgroundImage: blurDataUrl ? `url(${blurDataUrl})` : undefined, ...(fill ? {} : { width: props.width as number, height: props.height as number }) }}
      />
    );
  }
  if (broken) {
    return (
      <span role="img" aria-label={typeof props.alt === "string" ? props.alt : ""}
        className={cn(fill ? "absolute inset-0 grid place-items-center bg-surface-2" : "grid place-items-center bg-surface-2", "text-fg-subtle")}
        style={fill ? undefined : { width: props.width as number, height: props.height as number }}>
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden><circle cx="12" cy="12" r="6" /><path d="M12 9v3l2 1M10 3h4M10 21h4" /></svg>
      </span>
    );
  }
  if (linked) {
    // Linked product photo: served straight from its own host (no resizing, nothing stored here).
    // Retail shots are mostly on white and framed differently, so show the whole watch on white.
    return (
      <Image
        {...props}
        {...LINKED_IMAGE_PROPS}
        fill={fill}
        className={cn(className, "object-contain! bg-white p-[4%]")}
        {...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <Image
      {...props}
      fill={fill}
      className={className}
      {...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
      loader={priority ? sameOriginLoader : cdnLoader}
      placeholder={blurDataUrl ? "blur" : "empty"}
      blurDataURL={blurDataUrl ?? undefined}
      onError={() => setBroken(true)}
    />
  );
}
