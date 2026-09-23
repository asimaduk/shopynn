import { createFileRoute } from "@tanstack/react-router";
import { StorefrontProductPage } from "@/components/storefront/storefront-product";

type ProductSearch = {
  qty?: string;
};

export const Route = createFileRoute("/s/$storeCode/p/$productSlug")({
  validateSearch: (search: Record<string, unknown>): ProductSearch => ({
    qty: typeof search.qty === "string" ? search.qty : undefined,
  }),
  component: StorefrontProductRoute,
  head: ({ params }) => ({
    meta: [
      {
        title: `Order product — ${String(params.storeCode || "").toLowerCase()} · Shopynn`,
      },
      {
        name: "description",
        content: "Order this product for pickup or delivery. Pay when you receive it.",
      },
    ],
  }),
});

function StorefrontProductRoute() {
  const { storeCode: raw, productSlug } = Route.useParams();
  const storeCode = String(raw || "").toLowerCase();
  const { qty } = Route.useSearch();
  const initialQty = Math.max(1, Number.parseInt(String(qty || "1"), 10) || 1);
  return (
    <StorefrontProductPage
      storeCode={storeCode}
      productSlug={productSlug}
      initialQty={initialQty}
    />
  );
}
