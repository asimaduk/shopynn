# Ordering + Fabric QA Checklist

## 1) Database Migration Validation
- [ ] Run `schema.sql` on clean DB and confirm tables exist: `orders`, `order_items`, `order_status_history`, `customer_profiles`, `customer_store_access`, `warehouse_reference_codes`, `user_warehouse_access`.
- [ ] Run `seed-permissions.sql` and confirm `orders.*` permission codes are present.
- [ ] Run `alt.sql` on existing DB and confirm idempotent execution with no duplicate key failures.
- [ ] Confirm `products` includes: `product_type`, `measurement_unit`, `allows_fractional_qty`, `min_order_qty`, `qty_step`, `base_price_per_unit`.

## 2) API Contract Smoke Tests
- [ ] `POST /orders` creates order with `pending` status and inserts history.
- [ ] `GET /orders` returns store-scoped list for staff and customer-scoped list for customer profile users.
- [ ] `GET /orders/:id` returns order with `items` and `history`.
- [ ] `PATCH /orders/:id` only allows updates when status in `pending|confirmed`.
- [ ] `PATCH /orders/:id/status` blocks invalid transitions.
- [ ] `POST /orders/:id/cancel` works only from valid prior states.

## 3) Authorization + Subscription Gating
- [ ] Users without `orders.create` cannot create orders.
- [ ] Users without order feature entitlement receive `FEATURE_NOT_AVAILABLE`.
- [ ] Single-store users cannot query or mutate out-of-scope store orders.
- [ ] Users with `orders.multi_store.manage` can operate across assigned stores.

## 4) Mobile MVP Flows
- [ ] `Settings -> Orders` appears only for entitled users.
- [ ] Customer can create an order (`Orders -> New`) and see it in list.
- [ ] `OrderDetails` shows item lines and total.
- [ ] Staff can move status `pending -> confirmed -> processing -> ready -> completed`.
- [ ] Cancel button works and updates list/detail status.

## 5) Fabric Quantity Validation
- [ ] Create order item using decimal qty (`e.g. 2.5`) for cloth-like products.
- [ ] Confirm backend persists decimal quantity in `order_items.quantity`.
- [ ] Confirm total amount computes correctly for decimal quantities.

## 6) Pilot Demo Script
- [ ] Login as customer and place pickup order.
- [ ] Login as store cashier and confirm order.
- [ ] Move order to processing/ready/completed.
- [ ] Place another order and cancel from pending state.
- [ ] Show denied behavior with a non-entitled account.
