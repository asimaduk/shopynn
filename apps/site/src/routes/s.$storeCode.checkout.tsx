import { createFileRoute } from "@tanstack/react-router";
import { StorefrontCheckout } from "@/components/storefront/storefront-checkout";

type CheckoutSearch = {
  express?: string;
  pay?: string;
};

export const Route = createFileRoute("/s/$storeCode/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    express: typeof search.express === "string" ? search.express : undefined,
    pay: typeof search.pay === "string" ? search.pay : undefined,
  }),
  component: StorefrontCheckoutRoute,
  head: ({ params }) => ({
    meta: [
      { title: `Checkout — ${String(params.storeCode || "").toLowerCase()} · Shopynn` },
      { name: "description", content: "Verify your phone and place your order." },
    ],
  }),
});

function StorefrontCheckoutRoute() {
  const { storeCode: raw } = Route.useParams();
  const storeCode = String(raw || "").toLowerCase();
  const { express, pay } = Route.useSearch();
  return (
    <StorefrontCheckout
      storeCode={storeCode}
      express={express === "1" || express === "true"}
      payLater={pay === "later"}
    />
  );
}
