# API Integration Summary

Screens and components are wired to the endpoints defined in `API.md` via the central service in `src/services/api.js`.

## Service layer (`src/services/api.js`)

- **Paths**: All paths are relative to `config.BASE_API`; the request interceptor prepends the base URL.
- **Response shape**: API responses use `{ status, message, data }`. The service returns `data` (or the full response where needed). Use `normalizeList(raw)` for list responses that may be an array or `{ list, items, data }`.

## Auth

| Screen / flow | Endpoint | Notes |
|---------------|----------|--------|
| Login | `POST /users/login` | Stores token via `setTokens()`; optionally fetches profile with `GET /users/me`. |
| Forgot password | `POST /users/forgot-password` | Body: `{ email }`. |
| Reset password | `POST /users/reset-password` | Body: `{ password }` (new password). |
| Company details setup | `PUT /tenants/update-my-company-info` | After login, when company not set; body: `name`, `organization`, `phone`, `address`, `email`, `product_categorization`. On success dispatches `setCompanyDetails` so navigator shows Main. |

## Profile

| Screen | Endpoint(s) | Notes |
|--------|-------------|--------|
| Profile (My Profile) | `GET /users/me` | Loads current user; displays name, email, phone, branch, company name, staff id. |
| Profile form (Edit Profile) | `GET /users/me` (load), `PUT /users/:id` (save) | Loads profile to get id and initial values; saves name, email, phone, branch via update. |

## Users (system users)

| Screen | Endpoint(s) |
|--------|-------------|
| Users list | `GET /users` |
| User form (create) | `POST /users` |
| User form (edit) / User details | `PUT /users/:id` (update, toggle active, role) |

## Dashboard & home

| Screen | Endpoint(s) |
|--------|-------------|
| Dashboard | `GET /dashboard`, `GET /inventories/low-stock`, `GET /inventories/expiring` |

## Sales, purchases, inventory

| Screen | Endpoint(s) |
|--------|-------------|
| Sales list | `GET /sales` (with optional `startDate`, `endDate`) |
| Purchases list | `GET /purchases` (with optional date params) |
| Inventory (products) | `GET /products` via `products.list()` |

## Adjustments & transfers

| Screen | Endpoint(s) |
|--------|-------------|
| Adjusted quantities | `GET /adjustments` (with optional date params) |
| Transfers | `GET /transfers` (with optional date params) |

## Settings

| Screen | Endpoint(s) |
|--------|-------------|
| Customers | `GET /customers` (with optional date params) |
| Suppliers | `GET /suppliers` (with optional date params) |

## Fallback behaviour

- List screens keep local mock/initial data and use it when the API fails or returns empty, so the app remains usable offline or with a failing backend.
- Date range filters are passed as `startDate` / `endDate` in `YYYY-MM-DD` where the API supports them.

## Detail screens (wired)

| Screen | Endpoint(s) |
|--------|-------------|
| Sale details | `GET /sales/:id` |
| Purchase details | `GET /purchases/:id` |
| Customer details | `GET /customers/:id` |
| Supplier details | `GET /suppliers/:id` |
| Product details | `GET /products/:id` |
| Return details | `GET /returns/:id` |
| Stock count details | `GET /stock-counts/:id` |
| Expenditure details | `GET /expenses` (list, then find by id) | No `GET /expenses/:id`; uses list with date range and finds by id. Pull-to-refresh to refetch. |

## Create/update forms (wired)

| Screen | Endpoint(s) |
|--------|-------------|
| Customer form | `POST /customers`, `PUT /customers/:id` |
| Supplier form | `POST /suppliers`, `PUT /suppliers/:id` |
| Category form | `POST /categories`, `PUT /categories/:id` |
| Product form | `POST /products`, `PUT /products/:id` |
| Create warehouse | `POST /warehouses` |
| Edit warehouse | `PUT /warehouses/:id` |
| Create expenditure | `POST /expenses` |
| Product categories (delete) | `DELETE /categories/:id` |

## New-entity screens (wired)

| Screen | Endpoint(s) |
|--------|-------------|
| New sale | `POST /sales` (then share receipt) |
| New purchase | `POST /purchases` |
| New adjustment | `POST /adjustments` |
| New transfer | `POST /transfers` |
| New sales return | `POST /returns` (type: sales) |
| New purchase return | `POST /returns` (type: purchase) |

## Other screens (wired)

| Screen | Endpoint(s) |
|--------|-------------|
| Returns list | `GET /returns` |
| Stock count history | `GET /stock-counts` |
| Expenditures list | `GET /expenses` (with date params) |
| Warehouses list | `GET /warehouses` |
| Product categories list | `GET /categories` (on focus) |
| Notifications list | `GET /notifications` |
| Report detail | `GET /dashboard/profit-and-loss`, `GET /dashboard/cash-flow`, `GET /sales/cogs`, `GET /inventories/summary` (by report type) |
| Product transactions | `GET /transactions` (query: startDate, endDate, productId, type) |

## User preferences (notifications)

| Screen | Endpoint(s) | Notes |
|--------|-------------|--------|
| Notification settings | `GET /users/me/preferences` (load), `PUT /users/me/preferences` (save) | Loads preferences on mount; maps `notifications.types` to toggles (lowStock, newSale, approvals, dailySummary, marketing). Each toggle saves immediately. Preserves locale/timezone when saving. |

## Optional (not yet wired)

- **Locale / timezone UI**: Preferences API supports `locale`, `timezone`; no dedicated UI yet (values preserved when saving notification types).
