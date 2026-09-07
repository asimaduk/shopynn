# Ordering + Fabric Commerce Implementation Plan

## Goal

Implement a customer ordering capability that is store-scoped, role-aware, subscription-gated, and supports clothing/fabric quantity flows (yards/meters), with mobile as the primary client.

---

## Scope Summary

1. Ordering module:
   - Customer places orders against a specific store/warehouse
   - Pickup vs delivery
   - Track statuses
   - Cancel/edit before processing
   - Staff processes orders for assigned store(s)
2. Customer-store linkage:
   - Signup with store reference code
   - Add additional stores later
   - Inventory/catalog scoped to linked stores only
3. Staff operational scope:
   - Cashier/manager sees only orders for assigned store(s)
4. Fabric/clothing commerce:
   - Support fractional quantities (yards/meters)
   - Product-level measurement rules
5. Subscription + permission protocol:
   - New permissions and tier mapping in `seed-permissions.sql` + `alt.sql`
   - Route enforcement + UI feature gating

---

## Delivery Strategy

- Use feature flags for safe rollout:
  - `orderingModule`
  - `fabricQuantities`
  - `multiStoreCustomerAccess`
- Rollout order:
  1. Internal tenant
  2. Pilot tenant
  3. Client tenant
  4. Broad release

---

## Phase 1 (MVP): Ordering Foundations + Mobile Core

### A) Data Model

Add new tables:

- `customer_profiles`
  - `id`, `tenant_id`, `display_name`, `phone`, `email`, `status`, `created_at`, `updated_at`
- `warehouse_reference_codes` (or `warehouses.reference_code`)
  - Unique per store reference code
- `customer_store_access`
  - `customer_profile_id`, `warehouse_id`, `created_at`, unique pair
- `orders`
  - `id`, `tenant_id`, `warehouse_id`, `customer_profile_id`
  - `order_number`, `status`, `fulfillment_type` (`pickup|delivery`)
  - `delivery_address`, `contact_name`, `contact_phone`
  - `subtotal`, `discount`, `total`, `notes`
  - `created_by`, `updated_by`, `created_at`, `updated_at`
- `order_items`
  - `id`, `order_id`, `product_id`, `quantity`, `unit_price`, `line_total`, `notes`
- `order_status_history`
  - `id`, `order_id`, `from_status`, `to_status`, `changed_by`, `changed_at`, `note`

### B) Status Engine

Allowed transitions:

- `pending -> confirmed -> processing -> ready -> completed`
- `pending|confirmed -> cancelled`
- `completed|cancelled` are terminal

Rules:

- Edit/cancel allowed only in `pending|confirmed`
- Once `processing`, order details locked

### C) Backend API

Customer endpoints:

- `POST /customer-profiles/signup` (with reference code)
- `POST /customer-profiles/link-store`
- `GET /customer-profiles/stores`
- `GET /catalog?warehouse_id=...`
- `POST /orders`
- `GET /orders/my`
- `GET /orders/:id`
- `PATCH /orders/:id` (status-guarded)
- `POST /orders/:id/cancel`

Staff endpoints:

- `GET /store-orders?warehouse_id=&status=`
- `GET /store-orders/:id`
- `PATCH /store-orders/:id/status`
- `GET /store-orders/:id/history`

### D) Security and Protocol Enforcement

Apply on protected routes:

- `auth`
- `requireActiveSubscription`
- `requireFeature('orders.*')`
- `requirePermission('orders.*')`

Scope enforcement:

- Customer requests must be constrained by `customer_store_access`
- Staff requests constrained by assigned warehouses (`users.warehouse_id` for MVP)

### E) Mobile UI Flows (MVP)

Customer:

1. `SignUpWithReference`
2. `StoreValidationResult`
3. `StoreCatalog`
4. `ProductDetails`
5. `Cart`
6. `Checkout` (pickup/delivery)
7. `OrderPlaced`
8. `MyOrders`
9. `OrderDetails` (timeline + edit/cancel visibility by status)

Staff:

1. `StoreOrders`
2. `StoreOrderDetails`
3. `OrderStatusUpdateModal`
4. `OrderHistoryPanel`

### F) Permissions + Tier Mapping

Add permissions:

- `orders.view`
- `orders.create`
- `orders.update`
- `orders.cancel`
- `orders.process`
- `orders.status.update`
- `orders.store.view`
- `orders.store.manage`

Wire into:

- `apps/api/seed-permissions.sql`
- `apps/api/alt.sql`

Tier baseline:

- Free: none/minimal for ordering
- Basic: core ordering actions
- Standard: broader operational controls
- Premium: advanced analytics/exports (later phases)

### G) Acceptance Criteria (Phase 1)

- Customer can sign up with a valid store reference and place an order
- Invalid references are rejected with clear error messaging
- Staff only sees/updates orders belonging to assigned store
- Cancel/edit blocked once order enters `processing`
- Timeline records each status change
- Subscription/permission gates are enforced in API + UI

---

## Phase 2: Multi-Store Expansion + Operations Scale

### A) Data Model Enhancements

- Add `user_warehouse_access` for staff multi-store assignment
  - Keep `users.warehouse_id` for backward compatibility

### B) Customer Multi-Store Features

- Add store later via reference code
- Maintain multiple linked stores
- Active store switching in mobile app

### C) Staff Multi-Store Features

- Store switcher for managers/cashiers with multiple assignments
- Queue filters by store, status, and date

### D) Notifications

- Customer notifications:
  - order confirmed
  - processing
  - ready
  - completed
  - cancelled
- Staff notifications:
  - new order in assigned store

### E) Acceptance Criteria (Phase 2)

- Customer can link additional stores and browse scoped inventory
- Multi-store staff can process only assigned-store orders
- Notifications are sent for key order lifecycle events

---

## Phase 3: Fabric/Clothing Commerce + Advanced Controls

### A) Product Schema for Measurement-Based Sales

Extend `products`:

- `product_type` (`piece|fabric|service`)
- `measurement_unit` (`piece|yard|meter`)
- `allows_fractional_qty` boolean
- `min_order_qty` numeric
- `qty_step` numeric
- `base_price_per_unit` numeric (or align with existing `unit_price`)

### B) Quantity Precision Migration

Migrate quantity fields to numeric where required (e.g., `numeric(12,3)`):

- inventories
- sale/purchase/transfer/adjustment detail quantities
- return detail quantities
- reorder/minimum stock where fractional inventory is expected

### C) Validation Rules for Fabric Orders

- Fractional quantities only when `allows_fractional_qty = true`
- Enforce:
  - `qty >= min_order_qty`
  - `qty` aligns to `qty_step`
  - available stock check in store context

### D) Mobile Fabric UX

- Show price per unit (`GHS / yard`)
- Decimal stepper/input for quantity
- Live line total calculation
- Unit-aware stock display (`12.75 yards available`)
- Keep integer UX for piece products

### E) Advanced Ordering Features

- Optional assignment queue
- SLA timers/escalation
- Returns/refunds linkage
- Order exports/reports

### F) Tier + Permission Expansion

Add advanced permissions:

- `orders.export`
- `orders.analytics.view`
- `orders.automation.manage` (optional)

Map premium-only capabilities in both tier scripts.

### G) Acceptance Criteria (Phase 3)

- Fabric products support fractional quantities reliably end-to-end
- Reports/exports handle decimal quantities correctly
- Premium-only features are hidden/blocked for lower tiers

---

## Cross-Cutting Workstreams

### 1) Auditing

- Persist all status transitions in `order_status_history`
- Add audit log entries for key actions (create/cancel/status change)

### 2) Reporting

- Add order KPI blocks:
  - order volume
  - average fulfillment time
  - cancellation rate
  - pickup vs delivery split

### 3) Backward Compatibility

- Do not break current sales/purchases flows during rollout
- Keep existing warehouse assignment behavior while introducing many-to-many access

### 4) Feature Flags and Configuration

- Guard new screens/endpoints behind ordering/fabric feature flags
- Enable tenant-by-tenant

---

## QA Plan

### Unit / Integration

- Status transition validator
- Quantity validator (fabric vs piece)
- Store access scoping
- Cancel/edit lock after processing

### E2E

- Signup with valid/invalid reference
- Place pickup and delivery orders
- Customer edit/cancel before processing
- Customer blocked after processing
- Staff visibility limited to assigned store
- Fabric quantity decimal flow in cart/order/inventory

### Regression

- Existing inventory/sales/purchases unaffected
- Exports and reports precision checks
- Subscription gating consistency across web/mobile/api

---

## Suggested Timeline

- Week 1-2: schema + migrations + core API + status rules
- Week 3-4: customer mobile ordering flow
- Week 5: staff queue + status processing + notifications
- Week 6: QA hardening + pilot demo + fixes
- Week 7-8: multi-store expansion + fabric support rollout
- Week 9+: premium exports/analytics automation

---

## Implementation Order (Start Here)

1. Finalize status model + permissions list
2. Build DB migrations and seed updates
3. Implement core order APIs with strict state + scope checks
4. Build customer mobile ordering MVP
5. Build staff processing queue
6. Add fabric schema + decimal quantity support
7. Complete QA + pilot demo readiness

---

## Risks & Mitigations

- Quantity type migration risk:
  - Mitigate with staged migration + data backfill + precision tests
- Scope leakage (wrong store visibility):
  - Mitigate with shared scope middleware and integration tests
- UI/backend mismatch in state transitions:
  - Mitigate with backend-enforced transition validator as source of truth
- Tier misalignment:
  - Mitigate with matrix validation query per release

---

## Done Definition

The initiative is complete when:

- Customer ordering lifecycle works end-to-end on mobile
- Staff processing is store-scoped and audited
- Store reference onboarding is stable and extensible
- Fabric products support fractional yard/meter orders accurately
- Subscription and permission protocol is enforced across API/web/mobile

