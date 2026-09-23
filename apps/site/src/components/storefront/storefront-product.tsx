import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Minus, Plus } from "lucide-react";
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
import { writeCart } from "@/lib/storefront-cart";

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
        setQty((q) => {
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

  const orderNow = () => {
    if (!product) return;
    if (!inStock) {
      toast.error("This item is out of stock.");
      return;
    }
    if (qty > available) {
      toast.error(`Only ${available} in stock.`);
      return;
    }
    writeCart(storeCode, [
      {
        product_id: product.id,
        name: product.name,
        unit_price: Number(product.unit_price || 0),
        quantity: qty,
        thumbnail: product.thumbnail,
        quantity_available: available,
      },
    ]);
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
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Product unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error || "This item is not for sale right now."}</p>
        <Button asChild className="mt-6">
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

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-4">
      <div className="overflow-hidden rounded-lg bg-muted">
        {img ? (
          <img src={img} alt="" className="aspect-square w-full object-cover" />
        ) : (
          <div className="flex aspect-square items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
      </div>

      <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{storeName}</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
        {product.name}
      </h1>
      <p className="mt-2 text-xl font-semibold text-foreground">{formatGhs(Number(product.unit_price || 0))}</p>
      {!inStock ? (
        <p className="mt-2 text-sm font-medium text-destructive">Out of stock</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{available} in stock</p>
      )}
      {product.description ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Quantity</span>
        <div className="inline-flex items-center gap-1 rounded-md border border-border p-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9"
            disabled={!inStock}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease"
          >
            <Minus />
          </Button>
          <span className="min-w-8 text-center text-sm font-medium">{qty}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9"
            disabled={!inStock}
            onClick={() => setQty((q) => Math.min(available, q + 1))}
            aria-label="Increase"
          >
            <Plus />
          </Button>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Pay now with mobile money or card (Paystack), or choose pay on delivery / pickup at checkout.
      </p>

      <div className="mt-6 space-y-2">
        <Button className="w-full" size="lg" disabled={!inStock} onClick={orderNow}>
          {inStock ? `Order now · ${formatGhs(lineTotal)}` : "Out of stock"}
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/s/$storeCode" params={{ storeCode }}>
            See more from this store
          </Link>
        </Button>
      </div>

      <GetTheAppNote className="mt-10 mb-6" />
    </div>
  );
}
