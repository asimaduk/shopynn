import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cartCount } from "@/lib/storefront-cart";
import { storefrontImageUrl } from "@/lib/storefront-api";
import { cn } from "@/lib/utils";

/** YouTube-style overlapping badges: Shopynn overlaps tenant (matches mobile For You). */
function CollaboratorLogos({
  tenantLogoUri,
  tenantName,
}: {
  tenantLogoUri?: string | null;
  tenantName?: string | null;
}) {
  const shopynnSize = 30;
  const tenantSize = 32;
  const overlap = 12;
  const wrapW = shopynnSize + tenantSize - overlap;
  const wrapH = Math.max(shopynnSize, tenantSize);
  const initial =
    String(tenantName || "S")
      .trim()
      .charAt(0)
      .toUpperCase() || "S";

  return (
    <div className="relative shrink-0" style={{ width: wrapW, height: wrapH }} aria-hidden>
      {/* Tenant (back) */}
      <div
        className={cn(
          "absolute overflow-hidden rounded-full border-2 border-border bg-muted",
          "flex items-center justify-center",
        )}
        style={{
          width: tenantSize,
          height: tenantSize,
          left: shopynnSize - overlap,
          top: (wrapH - tenantSize) / 2,
          zIndex: 1,
        }}
      >
        {tenantLogoUri ? (
          <img src={tenantLogoUri} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">{initial}</span>
        )}
      </div>
      {/* Shopynn (front) */}
      <div
        className="absolute overflow-hidden rounded-full border-2 border-border bg-white p-1"
        style={{
          width: shopynnSize,
          height: shopynnSize,
          left: 0,
          top: (wrapH - shopynnSize) / 2,
          zIndex: 2,
        }}
      >
        <img src="/logo/shopynn-icon.png" alt="Shopynn" className="size-full object-contain" />
      </div>
    </div>
  );
}

export function StorefrontHeader({
  storeCode,
  storeName,
  companyName,
  companyLogo,
}: {
  storeCode: string;
  storeName?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
}) {
  const [count, setCount] = useState(0);
  const storeLabel = storeName || companyName || "Shopynn Store";
  const tenantLogoUri = storefrontImageUrl(companyLogo);

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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-8 lg:py-3.5">
        <Link
          to="/s/$storeCode"
          params={{ storeCode }}
          className="flex min-w-0 items-center gap-3"
        >
          <CollaboratorLogos tenantLogoUri={tenantLogoUri} tenantName={storeLabel} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold tracking-tight text-foreground lg:text-xl">
              Shopynn
            </p>
            <p className="truncate text-xs text-muted-foreground">Order online · {storeCode}</p>
          </div>
        </Link>
        <Link
          to="/s/$storeCode/checkout"
          params={{ storeCode }}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 lg:px-5 lg:py-2.5"
        >
          Cart
          {count > 0 ? (
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs tabular-nums">
              {count}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
