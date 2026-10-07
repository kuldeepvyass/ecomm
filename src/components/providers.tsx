"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { KEYS, readList, writeList } from "@/lib/client/storage";
import { mergeWishlist, toggleWishlist as toggleWishlistAction } from "@/server/actions/wishlist";

type Me = { id: string; name: string | null; email: string | null; role: "CUSTOMER" | "ADMIN"; image: string | null };

type StoreState = {
  loaded: boolean;
  user: Me | null;
  cartCount: number;
  wishlist: ReadonlySet<string>;
  compare: string[];
  refresh: () => Promise<void>;
  setCartCount: (n: number) => void;
  toggleWishlist: (productId: string, label?: string) => Promise<void>;
  toggleCompare: (productId: string) => void;
  clearCompare: () => void;
};

const StoreContext = createContext<StoreState | null>(null);
const Toaster = dynamic(() => import("sonner").then((m) => m.Toaster), { ssr: false });
const loadMotionFeatures = () => import("@/lib/client/motion-features").then((m) => m.default);
export const MAX_COMPARE = 3;

export function useStore() {
  const ctx = use(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <Providers>");
  return ctx;
}

export function Providers({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<Me | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [wishlist, setWishlist] = useState<ReadonlySet<string>>(new Set());
  const [compare, setCompare] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) return;
      const data: { user: Me | null; cartCount: number; wishlistIds: string[] } = await res.json();
      setUser(data.user);
      setCartCount(data.cartCount);
      if (data.user) {
        const local = readList(KEYS.wishlist);
        if (local.length) {
          const merged = await mergeWishlist(local);
          writeList(KEYS.wishlist, []);
          setWishlist(new Set(merged.ok ? merged.data.ids : data.wishlistIds));
        } else {
          setWishlist(new Set(data.wishlistIds));
        }
      } else {
        setWishlist(new Set(readList(KEYS.wishlist)));
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setCompare(readList(KEYS.compare));
    void refresh();
  }, [refresh]);

  const toggleWishlist = useCallback(
    async (productId: string, label?: string) => {
      const had = wishlist.has(productId);
      const next = new Set(wishlist);
      if (had) next.delete(productId);
      else next.add(productId);
      setWishlist(next); // optimistic
      if (!user) {
        writeList(KEYS.wishlist, [...next]);
      } else {
        const res = await toggleWishlistAction(productId);
        if (!res.ok) {
          setWishlist(wishlist);
          toast.error(res.error);
          return;
        }
      }
      toast.success(had ? "Removed from wishlist" : "Saved to wishlist", { description: label });
    },
    [user, wishlist],
  );

  const toggleCompare = useCallback((productId: string) => {
    setCompare((prev) => {
      let next: string[];
      if (prev.includes(productId)) next = prev.filter((id) => id !== productId);
      else if (prev.length >= MAX_COMPARE) {
        toast.message(`You can compare up to ${MAX_COMPARE} watches`, { description: "Remove one to add another." });
        return prev;
      } else next = [...prev, productId];
      writeList(KEYS.compare, next);
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => {
    writeList(KEYS.compare, []);
    setCompare([]);
  }, []);

  const value = useMemo<StoreState>(
    () => ({ loaded, user, cartCount, wishlist, compare, refresh, setCartCount, toggleWishlist, toggleCompare, clearCompare }),
    [loaded, user, cartCount, wishlist, compare, refresh, toggleWishlist, toggleCompare, clearCompare],
  );

  return (
    <StoreContext value={value}>
      <LazyMotion features={loadMotionFeatures} strict>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </LazyMotion>
      <Toaster
        position="top-center"
        offset={16}
        mobileOffset={{ top: 12 }}
        toastOptions={{
          classNames: {
            toast: "!bg-surface-2 !text-fg !border !border-border !rounded-[2px] !font-sans !shadow-luxe",
            description: "!text-fg-muted",
            actionButton: "!bg-gold !text-on-gold",
          },
        }}
      />
    </StoreContext>
  );
}
