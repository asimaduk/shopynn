import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Minus, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { GetTheAppNote } from "@/components/storefront/get-the-app-note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  getPublicStoreCatalog,
  storefrontImageUrl,
  storefrontProductPathKey,
  type StorefrontProduct,
  type StorefrontStore,
} from "@/lib/storefront-api";
import { cartCount, readCart, upsertCartLine } from "@/lib/storefront-cart";

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toFixed(2)}`;
}

export function StorefrontCatalog({ storeCode }: { storeCode: string }) {
  const [store, setStore] = useState<StorefrontStore | null>(null);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setCartTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicStoreCatalog(storeCode, search.trim() || undefined);
        if (cancelled) return;
        setStore(data.store);
        setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : "Could not load this store.";
        setError(msg);
        setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = window.setTimeout(load, search ? 280 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [storeCode, search]);

  useEffect(() => {
    const refresh = () => setCartTick((n) => n + 1);
    window.addEventListener("shopynn-cart", refresh);
    return () => window.removeEventListener("shopynn-cart", refresh);
  }, []);

  const qtyInCart = (productId: string) =>
    readCart(storeCode).find((l) => l.product_id === productId)?.quantity || 0;

  const setQty = (p: StorefrontProduct, quantity: number) => {
    const available = Number(p.quantity_available ?? 0);
    const next = available > 0 ? Math.min(Math.max(0, quantity), available) : Math.max(0, quantity);
    if (available > 0 && quantity > available) {
      toast.error(`Only ${available} in stock.`);
    }
    upsertCartLine(storeCode, {
      product_id: p.id,
      name: p.name,
      unit_price: Number(p.unit_price || 0),
      quantity: next,
      thumbnail: p.thumbnail,
      quantity_available: available,
    });
    setCartTick((n) => n + 1);
    if (next > 0) toast.success(`Updated ${p.name}`);
  };

  if (error && !loading && !store) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Store not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {store?.store?.name || store?.company?.name || "Catalog"}
        </h1>
        {store?.store?.address ? (
          <p className="mt-1 text-sm text-muted-foreground">{store.store.address}</p>
        ) : null}
        {Number(store?.store?.minimum_order_amount) > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Minimum order {formatGhs(Number(store?.store?.minimum_order_amount))}
          </p>
        ) : null}
      </div>

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products"
          className="h-11 pl-9"
          inputMode="search"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading products…
        </div>
      ) : products.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {search ? "No products match your search." : "No products available right now."}
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {products.map((p) => {
            const img = storefrontImageUrl(p.thumbnail);
            const qty = qtyInCart(p.id);
            return (
              <li key={p.id} className="flex gap-3 py-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  {img ? (
                    <img src={img} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/s/$storeCode/p/$productSlug"
                    params={{ storeCode, productSlug: storefrontProductPathKey(p) }}
                    className="truncate font-medium text-foreground hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted-foreground">{formatGhs(Number(p.unit_price || 0))}</p>
                  {qty === 0 ? (
                    <Button size="sm" className="mt-2" onClick={() => setQty(p, 1)}>
                      Add
                    </Button>
                  ) : (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-border bg-background p-0.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => setQty(p, Math.max(0, qty - 1))}
                        aria-label="Decrease"
                      >
                        <Minus />
                      </Button>
                      <span className="min-w-6 text-center text-sm font-medium">{qty}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => setQty(p, qty + 1)}
                        aria-label="Increase"
                      >
                        <Plus />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cartCount(storeCode) > 0 ? (
        <p className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground backdrop-blur md:hidden">
          {cartCount(storeCode)} item(s) in cart — open Cart to checkout
        </p>
      ) : null}

      <GetTheAppNote className="mt-10 mb-8" />
    </div>
  );
}
