import { createFileRoute } from "@tanstack/react-router";
import { StorefrontOrderConfirmation } from "@/components/storefront/storefront-order-confirmation";

type OrderSearch = {
  number?: string;
  total?: string;
  pay?: string;
  fulfill?: string;
  reference?: string;
  trxref?: string;
};

export const Route = createFileRoute("/s/$storeCode/order/$orderId")({
  validateSearch: (search: Record<string, unknown>): OrderSearch => ({
    number: typeof search.number === "string" ? search.number : undefined,
    total: typeof search.total === "string" ? search.total : undefined,
    pay: typeof search.pay === "string" ? search.pay : undefined,
    fulfill: typeof search.fulfill === "string" ? search.fulfill : undefined,
    reference: typeof search.reference === "string" ? search.reference : undefined,
    trxref: typeof search.trxref === "string" ? search.trxref : undefined,
  }),
  component: StorefrontOrderRoute,
  head: () => ({
    meta: [
      { title: "Order confirmed · Shopynn" },
      { name: "description", content: "Your order was sent to the store." },
    ],
  }),
});

function StorefrontOrderRoute() {
  const { storeCode: raw, orderId } = Route.useParams();
  const storeCode = String(raw || "").toLowerCase();
  const { number, total, pay, fulfill, reference, trxref } = Route.useSearch();
  return (
    <StorefrontOrderConfirmation
      storeCode={storeCode}
      orderId={orderId}
      orderNumber={number}
      total={total}
      payStatus={pay}
      fulfillment={fulfill}
      reference={reference || trxref}
    />
  );
}
