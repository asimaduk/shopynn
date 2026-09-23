import { createFileRoute } from "@tanstack/react-router";
import { StorefrontCatalog } from "@/components/storefront/storefront-catalog";

export const Route = createFileRoute("/s/$storeCode/")({
  component: StorefrontCatalogRoute,
  head: ({ params }) => ({
    meta: [
      { title: `Order online — ${String(params.storeCode || "").toLowerCase()} · Shopynn` },
      {
        name: "description",
        content: "Browse products and place an order. No app install required.",
      },
    ],
  }),
});

function StorefrontCatalogRoute() {
  const { storeCode: raw } = Route.useParams();
  const storeCode = String(raw || "").toLowerCase();
  return <StorefrontCatalog storeCode={storeCode} />;
}
