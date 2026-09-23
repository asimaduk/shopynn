import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cartCount } from "@/lib/storefront-cart";

export function StorefrontHeader({
  storeCode,
  storeName,
  companyName,
}: {
  storeCode: string;
  storeName?: string | null;
  companyName?: string | null;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(cartCount(storeCode));
    refresh();
    window.addEventListener("shopynn-cart", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("shopynn-cart", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [storeCode]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/s/$storeCode" params={{ storeCode }} className="min-w-0">
          <p className="truncate font-display text-lg font-semibold tracking-tight text-foreground">
            {storeName || companyName || "Shopynn Store"}
          </p>
          <p className="truncate text-xs text-muted-foreground">Order online · {storeCode}</p>
        </Link>
        <Link
          to="/s/$storeCode/checkout"
          params={{ storeCode }}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm"
        >
          Cart
          {count > 0 ? (
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">{count}</span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
