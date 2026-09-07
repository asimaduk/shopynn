# IMS (Inventory Management System) API Documentation

Base URL: **`/api`**

All successful responses follow this structure:

```json
{
  "status": 200,
  "message": "Description of the result",
  "data": { ... }
}
```

Error responses use the same structure with an appropriate `status` (4xx/5xx) and `message`.

---

## Authentication

Most endpoints require a **Bearer token** in the `Authorization` header:

```
Authorization: Bearer <JWT>
```

Endpoints that require an active subscription are marked with **(+ subscription)**. Public endpoints (no auth) are marked **(public)**.

---

## 1. Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/users/login` | public | Log in with email and password. Returns `{ token }`. |
| POST | `/api/users/forgot-password` | public | Request password reset. Body: `{ "email": "..." }`. Sends temporary password by email. |
| POST | `/api/users/reset-password` | ✓ | Set new password. Body: `{ "password": "..." }`. |
| POST | `/api/users/change-password` | ✓ + subscription | Change password using temporary password. Body: `{ "temporary_password": "...", "new_password": "..." }`. |
| GET | `/api/users/me` | ✓ + subscription | Get current user profile. |
| POST | `/api/users/me/profile-image` | ✓ + subscription | Set my profile image (multipart). Field: `image` (file). |
| DELETE | `/api/users/me/profile-image` | ✓ + subscription | Remove my profile image. |
| GET | `/api/users/me/preferences` | ✓ + subscription | Get current user preferences (notifications, locale, etc.). |
| PUT | `/api/users/me/preferences` | ✓ + subscription | Update preferences. Body: partial `{ notifications: { push, email, types }, locale, timezone }`. |
| GET | `/api/users` | ✓ + subscription | List all users. |
| POST | `/api/users` | ✓ + subscription | Create user. |
| PUT | `/api/users/toggle-active` | ✓ + subscription | Toggle a user's `is_active` flag. Body: `{ id, is_active }`. |
| PUT | `/api/users/:id` | ✓ + subscription | Update user. |
| DELETE | `/api/users/:id` | ✓ + subscription | Delete (deactivate) user. |
| POST | `/api/users/system-add` | public | System user creation (no auth). |

---

## App Versions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/app-versions/check` | public | Check app version status. Query: `platform` (`ios`/`android`/`web`), `current_version`. Returns `update_status` (`up_to_date`, `update_available`, `update_required`, `no_config`) plus version metadata. |
| GET | `/api/app-versions` | ✓ + subscription | List app version configs. Query: `platform`, `status`. |
| POST | `/api/app-versions` | ✓ + subscription | Create app version config. Body: `platform`, `latest_version`, optional `min_supported_version`, `force_update`, `status`, `store_url`, `release_notes`. |

---

## 2. Dashboard & Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard` | ✓ + subscription | Dashboard data (sales, purchases, expenses, stock, recent sales). Query: `recentLimit`. |
| GET | `/api/dashboard/profit-and-loss` | ✓ + subscription | P&L report. Query: `startDate`, `endDate` (or `from`, `to`). |
| GET | `/api/dashboard/cash-flow` | ✓ + subscription | Cash flow (inflows/outflows, records by type). Query: `startDate`, `endDate`. |

---

## 3. Sales

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sales` | ✓ | List sales. Query: `tenant_id`, `startDate`, `endDate`, `payment_status`, `soldBy`, etc. |
| GET | `/api/sales/me/mtd-total` | ✓ | Logged-in user's Month-To-Date sales total (sum of `total_amount` + transactions count). |
| GET | `/api/sales/by-date` | ✓ | List sales for a given date. Query: `date` (YYYY-MM-DD). Optional: `soldBy`, `payment_status`. |
| GET | `/api/sales/summary` | ✓ | Sales summary (totals, this week, last week, this month). Query: `startDate`, `endDate`. |
| GET | `/api/sales/revenue` | ✓ | Revenue report (daily breakdown). Query: `startDate`, `endDate`. |
| GET | `/api/sales/daily-summary` | ✓ | Daily sales summary (per-day totals, transaction count, avg per sale). Query: `startDate`, `endDate`. |
| GET | `/api/sales/cogs` | ✓ | COGS report (revenue, cogs, gross margin). Query: `startDate`, `endDate`, `productId`, `warehouseId`, `customerId`, `supplierId`. |
| GET | `/api/sales/customers-summary` | ✓ | Sales by customer (per-customer totals, orders count). Query: `startDate`, `endDate`. |
| GET | `/api/sales/customers-report` | ✓ | Sales by customer report (total customers count, overall total sum, list of customers with totals and sales count). Query: `startDate`, `endDate`. |
| GET | `/api/sales/users-summary` | ✓ | Sales by user (attendant) summary (per user totals and transactions count). Query: `startDate`, `endDate`. |
| GET | `/api/sales/top-products` | ✓ | Top 5 selling products (total revenue, units sold). Query: optional `startDate`, `endDate`. |
| GET | `/api/sales/attendants` | ✓ | List sale attendants. |
| GET | `/api/sales/details-list` | ✓ | List all sale detail lines. |
| GET | `/api/sales/:id` | ✓ | Get sale by ID. |
| POST | `/api/sales` | ✓ | Create sale. |

---

## 4. Purchases

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/purchases` | ✓ | List purchases. Query: `suppliedBy`, `receivedBy`, `startDate`, `endDate`, `current_status`. |
| GET | `/api/purchases/summary` | ✓ | Purchases summary (MTD). Query: `startDate`, `endDate`. |
| GET | `/api/purchases/suppliers-summary` | ✓ | Purchases by suppliers (MTD totals, total purchase count, number of suppliers, and per-supplier totals and transactions). Query: `startDate`, `endDate`, `warehouseId`. |
| GET | `/api/purchases/details-list` | ✓ | List purchase detail lines. |
| GET | `/api/purchases/:id` | ✓ | Get purchase by ID. |
| POST | `/api/purchases` | ✓ | Create purchase. |

---

## 5. Inventories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/inventories` | ✓ | List inventories. Query: filters. |
| GET | `/api/inventories/summary` | ✓ | Stock summary (count, units, value, low stock, list). |
| GET | `/api/inventories/low-stock` | ✓ | Low stock items. Query: `warehouseId`, etc. |
| GET | `/api/inventories/slow-moving` | ✓ | Slow-moving items. Query: `days`, `warehouseId`. |
| GET | `/api/inventories/expiring` | ✓ | Expiring items. Query: `days`, `warehouseId`. |
| GET | `/api/inventories/top-selling` | ✓ | Top-selling items. Query: `startDate`, `endDate`, `limit`. |
| POST | `/api/inventories/updates` | ✓ | Bulk inventory updates. |

---

## 6. Adjustments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/adjustments` | ✓ | List adjustments. Query: `startDate`, `endDate`, search. |
| GET | `/api/adjustments/summary` | ✓ | Adjustments summary (total adjustments count, sum of `number_of_items`, total quantity adjusted, and list of adjusted products with type, quantity, date, reason, warehouse, system_quantity). Query: `startDate`, `endDate`, `warehouseId`, `productId`, `category`. |
| GET | `/api/adjustments/details-list` | ✓ | List adjustment detail lines. |
| POST | `/api/adjustments` | ✓ | Create adjustment. |

---

## 7. Transfers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transfers` | ✓ | List transfers. Query: `startDate`, `endDate`, search. |
| GET | `/api/transfers/summary` | ✓ | Transfers summary (total transfers count, sum of `number_of_items`, total units moved, and list of transferred products with quantity, date, and source/destination warehouses). Query: `startDate`, `endDate`, `sourceWarehouseId`, `destinationWarehouseId`, `productId`. |
| GET | `/api/transfers/details-list` | ✓ | List transfer detail lines. |
| POST | `/api/transfers` | ✓ | Create transfer. |

---

## 8. Customers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/customers` | ✓ | List customers. Query: `startDate`, `endDate`, search. |
| GET | `/api/customers/:id` | ✓ | Get customer by ID. |
| GET | `/api/customers/:id/sales` | ✓ | Sales for a customer. Query: `startDate`, `endDate`. |
| POST | `/api/customers` | ✓ | Create customer. |
| PUT | `/api/customers/:id` | ✓ | Update customer. |
| DELETE | `/api/customers/:id` | ✓ | Delete customer. |

---

## 9. Suppliers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/suppliers` | ✓ | List suppliers. Query: `startDate`, `endDate`, search. |
| GET | `/api/suppliers/:id` | ✓ | Get supplier by ID. |
| GET | `/api/suppliers/:id/purchases` | ✓ | Purchases for a supplier. Query: `startDate`, `endDate`. |
| POST | `/api/suppliers` | ✓ | Create supplier. |
| PUT | `/api/suppliers/:id` | ✓ | Update supplier. |

---

## 10. Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products` | ✓ + subscription | List products. Query: search, filters. |
| GET | `/api/products/by-category/:categoryId` | ✓ + subscription | List products for a given category. Query: `search`/`q`, pagination. |
| GET | `/api/products/count` | ✓ | Products count. |
| GET | `/api/products/export` | ✓ | Export products. |
| GET | `/api/products/slug/:slug` | ✓ | Get product by slug. |
| GET | `/api/products/:id` | ✓ | Get product by ID. |
| GET | `/api/products/transfers` | ✓ | List transfers. |
| GET | `/api/products/transfers/:id` | ✓ | Get transfer by ID. |
| POST | `/api/products` | ✓ | Create product. |
| POST | `/api/products/transfers` | ✓ | Create transfer. |
| POST | `/api/products/update-images` | ✓ | Update product images. |
| POST | `/api/products/change-price` | ✓ | Change product price (unit and/or alt) and create an audit log entry. Body: `id`, optional `unit_price`, `alt_price`. |
| PUT | `/api/products/toggle-status` | ✓ | Toggle product status. |
| PUT | `/api/products/:id` | ✓ | Update product. |
| DELETE | `/api/products/:id` | ✓ | Delete product. |

---

## 11. Warehouses

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/warehouses` | ✓ + subscription | List warehouses. |
| GET | `/api/warehouses/:id` | ✓ | Get warehouse by ID. |
| POST | `/api/warehouses` | ✓ | Create warehouse. |
| PUT | `/api/warehouses/:id` | ✓ | Update warehouse. |

---

## 12. Categories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/categories` | ✓ | List categories. Query: `startDate`, `endDate`, search. |
| GET | `/api/categories/:id` | ✓ | Get category by ID. |
| POST | `/api/categories` | ✓ | Create category. |
| PUT | `/api/categories/:id` | ✓ | Update category. |
| DELETE | `/api/categories/:id` | ✓ | Delete category. |

---

## 13. Expenses

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/expenses` | ✓ | List expenses. Query: `startDate`, `endDate`, search. |
| POST | `/api/expenses` | ✓ | Create expense. |
| PUT | `/api/expenses/:id` | ✓ | Update expense. |

---

## 14. Locations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/locations` | ✓ + subscription | List locations. |
| GET | `/api/locations/:id` | ✓ | Get location by ID. |
| POST | `/api/locations` | ✓ | Create location. |
| PUT | `/api/locations/:id` | ✓ | Update location. |

---

## 15. Stock Counts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stock-counts` | ✓ + subscription | List stock counts. Query: filters. |
| GET | `/api/stock-counts/:id` | ✓ | Get stock count by ID. |
| POST | `/api/stock-counts` | ✓ | Create stock count. |

---

## 16. Returns

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/returns` | ✓ + subscription | List returns. Query: filters. |
| GET | `/api/returns/:id` | ✓ | Get return by ID. |
| POST | `/api/returns` | ✓ | Create return. |

---

## 17. Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/payments/webhook` | public | Paystack webhook (raw body). Do not call directly. |
| GET | `/api/payments` | ✓ + subscription | List payments. |
| GET | `/api/payments/tenant/:tenantId` | ✓ | Payments by tenant. Query: `startDate`, `endDate`. |
| GET | `/api/payments/customer/:customerId` | ✓ | Payments by customer. Query: `startDate`, `endDate`. |
| GET | `/api/payments/verify` | ✓ | Verify transaction (query: `reference`). |
| GET | `/api/payments/verify/:reference` | ✓ | Verify transaction by reference. |
| GET | `/api/payments/:id` | ✓ | Get payment by ID. |
| POST | `/api/payments` | ✓ | Create payment record. |
| POST | `/api/payments/initiate` | ✓ | Initiate payment (card redirect or mobile money). Body: `amount`, `payment_method` (card | mobile_money), `email`, etc. For mobile_money: `phone`, `provider`. |
| POST | `/api/payments/submit-otp` | ✓ | Submit OTP for mobile money charge. |

On successful Paystack settlement (`verify`, `submit-otp`, or `webhook`), subscription payments (no `order_id`) automatically call **`activatePendingSubscriptionService`** for the tenant’s linked pending plan. Initiate checkout attaches `subscription_id` from the tenant when omitted.

---

## 18. Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | ✓ + subscription | List notifications. Query: `startDate`, `endDate`, `read`, `limit`. |
| GET | `/api/notifications/:id` | ✓ | Get notification by ID. |
| POST | `/api/notifications` | ✓ | Create notification. |
| POST | `/api/notifications/send-fcm` | ✓ | Send FCM message. Body: tokens/topic, title, body, data. |
| PATCH | `/api/notifications/:id/read` | ✓ | Mark notification as read. |

---

## 19. Subscriptions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/subscriptions/onboard` | ✓ | Create or **upgrade** subscription. Body: `subscription_type` (1–4). Upgrading from an **active** higher tier creates a pending plan without swapping access; remaining paid days are prorated into bonus days on the new plan after payment. |
| GET | `/api/subscriptions/current` | ✓ | Get current subscription for the tenant. |

---

## 20. Tenants (tenant-first setup)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/tenants/setup` | public | Create tenant then subscription (tenant first). Body: `name`, `phone`, `subscription_type` (1–4), optional `organization`, `notes`, `product_categorization`. |
| POST | `/api/tenants` | public | Create tenant only (no subscription). Body: `name`, `phone`, optional `organization`, `notes`, `product_categorization`. |
| GET | `/api/tenants` | public | List tenants. Query: `name` / `search` / `q` (ILIKE on name/organization), `startDate` / `endDate` or `from` / `to` (on `created_at`). |
| GET | `/api/tenants/:id` | public | Get tenant by ID (includes subscription info if linked). |
| PUT | `/api/tenants/:id` | public | Update tenant by ID (partial). Body/query: optional tenant fields; `setup_inventory` (true) to create warehouse + inventories. See below. |
| PUT | `/api/tenants/update-my-company-info` | ✓ auth + subscription | Update the current user's tenant (tenant_id from auth). Same body/query as update tenant; see below. |

### Update tenant — `PUT /api/tenants/:id`

Updates a tenant by ID. Only provided fields are changed; omitted fields are left unchanged. Optionally creates a new warehouse and inventory rows for products matching the tenant’s `product_categorization`.

**URL:** `PUT /api/tenants/:id`  
**Path:** `id` — tenant UUID.

**Body (all optional):**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Tenant display name. |
| `organization` | string | Organization name. |
| `phone` | string | Contact phone. |
| `notes` | string | Notes. |
| `address` | string | Address. |
| `email` | string | Contact email. |
| `city` | string | City. |
| `state` | string | State / region. |
| `country` | string | Country. |
| `postal_code` | string | Postal / ZIP code. |
| `website` | string | Website URL. |
| `logo` | string | Logo URL or identifier. |
| `industry_id` | string (UUID) | Industry this tenant belongs to (from `/api/industries`). |
| `product_categorization` | string | Product categorization (used when `setup_inventory` is true to match products). |
| `warehouse_name` | string | Name for the new warehouse when `setup_inventory` is true (default: `"Default Warehouse"`). |

**Query / body:** `setup_inventory` (boolean, default `false`). If `true`, the service:

1. Creates a new warehouse for the tenant (name from `warehouse_name` or `"Default Warehouse"`).
2. Creates inventory rows for all products that match the tenant’s `product_categorization` in that warehouse only (no change to other warehouses).

**Response:** The updated tenant row (same shape as get-by-id). When `setup_inventory` was `true`, the response also includes `inventories_created` (number of new inventory rows created for the new warehouse).

---

## 21. Transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions` | ✓ + subscription | List transactions. Query: filters. |
| GET | `/api/transactions/:id` | ✓ | Get transaction by ID. |

---

## 22. Emails

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/emails` | ✓ + subscription | Send email. Body: recipient, subject, message, etc. |

---

## 23. Industries

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/industries` | ✓ + subscription | List industries (optional search with `name`/`search`/`q`). |
| GET | `/api/industries/:id` | ✓ + subscription | Get a single industry by ID. |
| POST | `/api/industries` | ✓ + subscription | Create an industry. Body: `name` (required), optional `code`, `description`, `product_categorization`. |

Industries are reference data used by tenants via the `industry_id` field on tenant records (for example through `PUT /api/tenants/:id` or `PUT /api/tenants/update-my-company-info`).

---

## 23. Images

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/images` | ✓ | Get image (query params for identifier). |
| POST | `/api/images` | ✓ | Upload images (multipart). |

---

## 24. Roles & Permissions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/roles` | ✓ + subscription | List roles. |
| GET | `/api/roles/:id` | ✓ | Get role by ID. |
| GET | `/api/roles/:id/permissions` | ✓ | Get role permissions. |
| POST | `/api/roles` | ✓ | Create role. |
| PUT | `/api/roles/:id` | ✓ | Update role. |
| DELETE | `/api/roles/:id` | ✓ | Delete role. |
| POST | `/api/roles/:id/permissions` | ✓ | Add permission to role. Body: `permissionId`. |
| DELETE | `/api/roles/:id/permissions/:permissionId` | ✓ | Remove permission from role. |
| PUT | `/api/roles/:id/permissions` | ✓ | Set role permissions. Body: `permissionIds[]`. |
| GET | `/api/permissions` | ✓ + subscription | List all permissions. |
| GET | `/api/permissions/:id` | ✓ | Get permission by ID. |

---

## 25. User Management (Roles)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/user-management/me/permissions` | ✓ | Current user's permission codes. |
| GET | `/api/user-management/me/roles` | ✓ | Current user's roles. |
| GET | `/api/user-management/users` | ✓ | List users with their roles. |
| GET | `/api/user-management/users/:userId/roles` | ✓ | Get roles for a user. |
| POST | `/api/user-management/users/:userId/roles` | ✓ | Assign role. Body: `roleId`. |
| DELETE | `/api/user-management/users/:userId/roles/:roleId` | ✓ | Remove role from user. |
| PUT | `/api/user-management/users/:userId/roles` | ✓ | Set user roles. Body: `roleIds[]`. |

---

## 26. Audit Logs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/audit-logs` | ✓ + subscription | List audit logs. Query: filters. |

---

## Query parameters (common)

- **startDate**, **endDate** (or **from**, **to**): `YYYY-MM-DD` for date ranges.
- **search**, **name**, **q**: text search where supported.
- **limit**: max number of items (where supported).

---

## Login request example

```http
POST /api/users/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

Response:

```json
{
  "status": 200,
  "message": "Login success.",
  "data": { "token": "eyJhbGc..." }
}
```

Use `data.token` as the Bearer token for subsequent requests.

---

## Customer orders — pay over time

Products may set `installment_enabled`, `installment_min_initial_percent`, `installment_min_payment_amount`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders` | ✓ | Create order. Body may include `payment_mode: 'installment'` and `initial_payment_amount` (all line items must be installment-eligible). |
| GET | `/api/orders/:id` | ✓ | Returns `payment_mode`, `amount_paid`, `balance_due`, `installment_payments[]`, `can_pay_partial`. |
| POST | `/api/orders/:id/payments/partial/initiate` | ✓ | Customer partial payment. Body: `amount`, `payment_method`, optional `phone`, `provider`. |
| POST | `/api/store-orders/:id/payments/partial/record` | ✓ | Merchant records cash partial. Body: `amount`, optional `note`. |

Fulfillment status transitions to `ready`+ are blocked while `balance_due > 0` on installment orders.

---

## Shop owner signup — email verification

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/users/shop-owner-signup/send-email-otp` | public | Body: `{ email }`. Sends 6-digit OTP to owner login email (10 min). |
| POST | `/api/users/shop-owner-signup/verify-email-otp` | public | Body: `{ email, otp }`. Returns `{ verification_token }` (30 min). |
| POST | `/api/tenants/setup` | public | **Requires** `verification_token` (from verify-email-otp) with `owner_email` for self-serve shop signup. Merchant partner onboard skips this internally. |

Run migration: `migrations/20260521_email_verification_codes.sql`
