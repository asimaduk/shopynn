import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Minus, Plus, ShoppingBag, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GetTheAppNote } from "@/components/storefront/get-the-app-note";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  getPublicStoreProduct,
  storefrontImageUrl,
  type StorefrontProduct,
  type StorefrontStore,
} from "@/lib/storefront-api";
import { readCart, upsertCartLine, writeCart } from "@/lib/storefront-cart";
import { cn } from "@/lib/utils";

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toFixed(2)}`;
}

export function StorefrontProductPage({
  storeCode,
  productSlug,
  initialQty = 1,
}: {
  storeCode: string;
  productSlug: string;
  initialQty?: number;
}) {
  const navigate = useNavigate();
  const [store, setStore] = useState<StorefrontStore | null>(null);
  const [product, setProduct] = useState<(StorefrontProduct & { description?: string | null }) | null>(
    null,
  );
  const [qty, setQty] = useState(Math.max(1, initialQty));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPublicStoreProduct(storeCode, productSlug)
      .then((data) => {
        if (cancelled) return;
        setStore(data.store);
        setProduct(data.product);
        const available = Number(data.product?.quantity_available ?? 0);
        setQty(() => {
          const start = Math.max(1, initialQty);
          if (available <= 0) return 1;
          return Math.min(start, available);
        });
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "Product not found.");
        setProduct(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeCode, productSlug, initialQty]);

  const available = Number(product?.quantity_available ?? 0);
  const inStock = available > 0;
  const showLowStock = inStock && available <= 5;

  const cartLine = (quantity: number) => {
    if (!product) return null;
    return {
      product_id: product.id,
      name: product.name,
      unit_price: Number(product.unit_price || 0),
      quantity,
      thumbnail: product.thumbnail,
      quantity_available: available,
    };
  };

  const addToCart = () => {
    if (!product || !inStock) {
      toast.error("This item is out of stock.");
      return;
    }
    if (qty > available) {
      toast.error(`Only ${available} in stock.`);
      return;
    }
    const existing = readCart(storeCode).find((l) => l.product_id === product.id);
    const nextQty = Math.min(available, (existing?.quantity || 0) + qty);
    const line = cartLine(nextQty);
    if (!line) return;
    upsertCartLine(storeCode, line);
    toast.success(`Added ${product.name} to cart`);
  };

  const orderNow = () => {
    if (!product || !inStock) {
      toast.error("This item is out of stock.");
      return;
    }
    if (qty > available) {
      toast.error(`Only ${available} in stock.`);
      return;
    }
    const line = cartLine(qty);
    if (!line) return;
    writeCart(storeCode, [line]);
    void navigate({
      to: "/s/$storeCode/checkout",
      params: { storeCode },
      search: { express: "1" },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Product unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error || "This item is not for sale right now."}
        </p>
        <Button asChild className="mt-7 rounded-full px-6" size="lg">
          <Link to="/s/$storeCode" params={{ storeCode }}>
            Browse store
          </Link>
        </Button>
      </div>
    );
  }

  const img = storefrontImageUrl(product.thumbnail);
  const lineTotal = qty * Number(product.unit_price || 0);
  const storeName = store?.store?.name || store?.company?.name || storeCode;
  const unitPrice = Number(product.unit_price || 0);

  return (
    <div className="mx-auto max-w-5xl px-3 pb-28 pt-3 sm:px-5 lg:px-8 lg:pb-12 lg:pt-5">
      <Link
        to="/s/$storeCode"
        params={{ storeCode }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to {storeName}
      </Link>

      <div className="mt-4 grid gap-6 lg:mt-5 lg:grid-cols-12 lg:gap-8">
        {/* Gallery */}
        <div className="lg:col-span-5">
          <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-xl bg-muted ring-1 ring-border/50 lg:mx-0 lg:sticky lg:top-20">
            {img ? (
              <img
                src={img}
                alt={product.name}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-sm text-muted-foreground">
                No image
              </div>
            )}
            <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
              {product.installment_enabled ? (
                <span className="rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Pay over time
                </span>
              ) : null}
              {showLowStock ? (
                <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Low stock
                </span>
              ) : null}
              {!inStock ? (
                <span className="rounded-full bg-destructive px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Out of stock
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Buy box */}
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-20">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {storeName}
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {product.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {formatGhs(unitPrice)}
              </p>
              <p
                className={cn(
                  "pb-0.5 text-sm font-medium",
                  inStock ? "text-emerald-600" : "text-destructive",
                )}
              >
                {inStock ? `${available} in stock` : "Out of stock"}
              </p>
            </div>

            {product.sku ? (
              <p className="mt-1.5 text-xs text-muted-foreground">SKU {product.sku}</p>
            ) : null}

            {product.description ? (
              <div className="mt-4 border-t border-border/70 pt-4">
                <h2 className="text-sm font-semibold text-foreground">About this product</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            ) : null}

            <div className="mt-5 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium">Quantity</span>
                <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full"
                    disabled={!inStock}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full"
                    disabled={!inStock}
                    onClick={() => setQty((q) => Math.min(available, q + 1))}
                    aria-label="Increase"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Line total</span>
                <span className="font-semibold tabular-nums">{formatGhs(lineTotal)}</span>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Pay now with mobile money or card (Paystack), or choose pay on delivery / pickup at
                checkout.
              </p>

              <div className="mt-4 hidden space-y-2 lg:block">
                <Button
                  className="h-11 w-full rounded-full text-sm font-semibold"
                  size="lg"
                  disabled={!inStock}
                  onClick={orderNow}
                >
                  <ShoppingBag className="size-4" />
                  {inStock ? `Buy now · ${formatGhs(lineTotal)}` : "Out of stock"}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-full text-sm font-semibold"
                  size="lg"
                  disabled={!inStock}
                  onClick={addToCart}
                >
                  <ShoppingCart className="size-4" />
                  Add to cart
                </Button>
                <Button asChild variant="ghost" className="h-9 w-full">
                  <Link to="/s/$storeCode" params={{ storeCode }}>
                    Continue shopping
                  </Link>
                </Button>
              </div>
            </div>

            <GetTheAppNote className="mt-6 hidden lg:block" />
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            variant="outline"
            className="h-12 flex-1 rounded-full font-semibold"
            disabled={!inStock}
            onClick={addToCart}
          >
            <ShoppingCart className="size-4" />
            Add
          </Button>
          <Button
            className="h-12 flex-[1.4] rounded-full font-semibold"
            disabled={!inStock}
            onClick={orderNow}
          >
            {inStock ? `Buy · ${formatGhs(lineTotal)}` : "Out of stock"}
          </Button>
        </div>
      </div>

      <GetTheAppNote className="mt-10 mb-6 lg:hidden" />
    </div>
  );
}
