# Pay over time (customer orders)

Customers can buy eligible products with **flexible partial payments** — there is **no fixed payment schedule**. They pay any amount, anytime, until `balance_due` reaches zero.

## Merchant setup (ims-web)

1. Open a product → **Pay over time** section.
2. Enable **Allow customers to pay over time**.
3. Optionally set:
   - **Minimum initial payment (%)** — down payment at checkout.
   - **Minimum partial payment (GHS)** — smallest amount per later payment.

## Customer flow (Cheqstock)

1. **For You** — products show a **Pay over time** badge when eligible.
2. **Checkout** — if every cart item is eligible, choose **Pay in full** or **Pay over time**. Optional initial payment applies at order creation.
3. After the store **confirms** the order, **My order details** shows balance, progress, and **Make a payment** (custom amount or presets).
4. Payments use Paystack (MoMo/card) via partial initiate API.

## Store staff (ims-web)

On **Store order details** for pay-over-time orders:

- View **amount paid**, **balance due**, and payment history.
- **Record cash** partial payments until balance is zero.
- Fulfillment (`ready` and beyond) is blocked until the balance is cleared.

## API (ims-services)

- `POST /orders` — `payment_mode: 'installment'`, optional `initial_payment_amount`
- `GET /orders/:id` — `balance_due`, `amount_paid`, `installment_payments[]`, `can_pay_partial`
- `POST /orders/:id/payments/partial/initiate` — customer partial Paystack
- `POST /store-orders/:id/payments/partial/record` — merchant cash partial

Run migration: `migrations/20260520_order_installments.sql`
