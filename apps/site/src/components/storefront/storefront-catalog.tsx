import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, MapPin, Minus, Package, Plus, Search, ShoppingBag, ShoppingCart } from "lucide-react";
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
import { cn } from "@/lib/utils";

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toFixed(2)}`;
}

/** Mobile brick image height — uniform so 2-col rows stay aligned. Desktop uses aspect ratio. */
function brickImageClass(_index: number) {
  return "h-[160px] sm:h-[176px] lg:h-auto";
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

  const storeTitle = store?.store?.name || store?.company?.name || "Catalog";
  const itemsInCart = cartCount(storeCode);

  if (error && !loading && !store) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Store not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3 pb-24 pt-4 sm:px-5 lg:px-8 lg:pb-16 lg:pt-8">
      {/* Mobile store header */}
      <div className="mb-5 lg:hidden">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {storeTitle}
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

      {/* Desktop storefront hero + toolbar */}
      <section className="mb-8 hidden lg:block">
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card px-8 py-9 shadow-sm">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(900px circle at 12% 20%, rgb(10 116 218 / 0.1), transparent 45%), radial-gradient(700px circle at 88% 10%, rgb(255 140 66 / 0.08), transparent 40%)",
            }}
            aria-hidden
          />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Shop online
              </p>
              <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground xl:text-5xl">
                {storeTitle}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {store?.store?.address ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    {store.store.address}
                  </span>
                ) : null}
                {Number(store?.store?.minimum_order_amount) > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="size-3.5 shrink-0" />
                    Min. order {formatGhs(Number(store?.store?.minimum_order_amount))}
                  </span>
                ) : null}
              </div>
            </div>

            {itemsInCart > 0 ? (
              <Link
                to="/s/$storeCode/checkout"
                params={{ storeCode }}
                className="inline-flex items-center gap-2.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                <ShoppingBag className="size-4" />
                View cart · {itemsInCart}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-foreground">
              All products
            </p>
            {!loading ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {products.length} {products.length === 1 ? "item" : "items"}
                {search.trim() ? " matching your search" : ""}
              </p>
            ) : null}
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the catalog"
              className="h-11 rounded-full border-border/80 bg-card pl-10 shadow-none"
              inputMode="search"
            />
          </div>
        </div>
      </section>

      {/* Mobile search */}
      <div className="relative mb-5 max-w-xl lg:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products"
          className="h-11 rounded-xl border-border/80 bg-card pl-9 shadow-sm"
          inputMode="search"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading products…
        </div>
      ) : products.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">
          {search ? "No products match your search." : "No products available right now."}
        </p>
      ) : (
        <ul
          className={cn(
            /* Mobile / tablet: 2-col grid (CSS columns left a top-right gap) */
            "grid grid-cols-2 gap-2.5 sm:gap-3",
            /* Desktop: denser catalog grid */
            "lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8 xl:grid-cols-6",
          )}
        >
          {products.map((p, index) => {
            const img = storefrontImageUrl(p.thumbnail);
            const qty = qtyInCart(p.id);
            const stockCount = Number(p.quantity_available ?? 0);
            const inStock = stockCount > 0;
            const showLowStock = inStock && stockCount <= 5;
            const canAdd = p.quantity_available == null || inStock;
            const productHref = {
              to: "/s/$storeCode/p/$productSlug" as const,
              params: { storeCode, productSlug: storefrontProductPathKey(p) },
            };

            return (
              <li
                key={p.id}
                className="min-w-0"
              >
                <article className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-card shadow-[0_3px_12px_rgb(0_0_0_/0.07)] ring-1 ring-border/50 transition duration-300 hover:shadow-[0_6px_20px_rgb(0_0_0_/0.1)] lg:rounded-2xl lg:bg-transparent lg:shadow-none lg:ring-0 lg:hover:shadow-none">
                  <div className="relative overflow-hidden lg:rounded-2xl lg:bg-muted/60">
                    <Link
                      {...productHref}
                      className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div
                        className={cn(
                          "relative w-full overflow-hidden bg-muted lg:aspect-[4/5]",
                          brickImageClass(index),
                        )}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            className="size-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                            No image
                          </div>
                        )}
                        <div
                          className="pointer-events-none absolute inset-0 bg-black/8 lg:bg-gradient-to-t lg:from-black/25 lg:via-transparent lg:to-transparent lg:opacity-0 lg:transition lg:group-hover:opacity-100"
                          aria-hidden
                        />
                        {(p.installment_enabled || showLowStock) && (
                          <div className="absolute left-2 right-2 top-2 flex flex-wrap gap-1.5 lg:left-3 lg:right-3 lg:top-3">
                            {p.installment_enabled ? (
                              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white lg:px-2.5 lg:py-1 lg:text-[10px]">
                                Pay over time
                              </span>
                            ) : null}
                            {showLowStock ? (
                              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white lg:px-2.5 lg:py-1 lg:text-[10px]">
                                Low stock
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Desktop quick-add — always visible when in cart, hover-reveal when empty */}
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 hidden p-3 transition duration-300 lg:block",
                        qty > 0
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                      )}
                    >
                      {qty === 0 ? (
                        <Button
                          type="button"
                          className="h-11 w-full rounded-full text-sm font-semibold shadow-lg"
                          disabled={!canAdd}
                          onClick={() => setQty(p, 1)}
                        >
                          <ShoppingCart className="size-4" />
                          Add to cart
                        </Button>
                      ) : (
                        <div className="flex items-center justify-between rounded-full bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-9 rounded-full"
                            onClick={() => setQty(p, Math.max(0, qty - 1))}
                            aria-label="Decrease"
                          >
                            <Minus className="size-4" />
                          </Button>
                          <span className="text-sm font-semibold tabular-nums">{qty} in cart</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-9 rounded-full"
                            onClick={() => setQty(p, qty + 1)}
                            aria-label="Increase"
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5 px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3 lg:px-0.5 lg:pb-0 lg:pt-2">
                    <Link
                      {...productHref}
                      className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition hover:text-primary lg:text-[15px]"
                    >
                      {p.name}
                    </Link>
                    <p
                      className={cn(
                        "text-xs font-medium leading-tight",
                        inStock ? "text-emerald-600" : "text-destructive",
                      )}
                    >
                      {inStock ? "In stock" : "Out of stock"}
                    </p>

                    <div className="mt-0.5 flex items-center justify-between gap-2 lg:mt-1">
                      <p className="truncate text-sm font-semibold text-primary lg:text-base lg:font-bold lg:tracking-tight lg:text-foreground">
                        {formatGhs(Number(p.unit_price || 0))}
                      </p>

                      {/* Mobile cart controls */}
                      <div className="lg:hidden">
                        {qty === 0 ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="size-8 shrink-0 rounded-full"
                            onClick={() => setQty(p, 1)}
                            aria-label={`Add ${p.name} to cart`}
                            disabled={!canAdd}
                          >
                            <ShoppingCart className="size-4" />
                          </Button>
                        ) : (
                          <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7 rounded-full"
                              onClick={() => setQty(p, Math.max(0, qty - 1))}
                              aria-label="Decrease"
                            >
                              <Minus className="size-3.5" />
                            </Button>
                            <span className="flex min-w-5 items-center justify-center gap-0.5 text-xs font-semibold">
                              <Check className="size-3 text-primary" aria-hidden />
                              {qty}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7 rounded-full"
                              onClick={() => setQty(p, qty + 1)}
                              aria-label="Increase"
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {itemsInCart > 0 ? (
        <p className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground backdrop-blur md:hidden">
          {itemsInCart} item(s) in cart — open Cart to checkout
        </p>
      ) : null}

      <GetTheAppNote className="mt-12 mb-8 lg:mt-16" />
    </div>
  );
}
