# Cheqstock ↔ ims-web feature parity

Canonical API contract: [apps/api/docs/API.md](../apps/api/docs/API.md).  
Backend route truth may differ slightly from API.md (e.g. user delete uses `PUT /users/:id/delete` in ims-services).

## 1. ims-web routes (control-panel)

Grouped by URL prefix. Each row is a `page.tsx` route; primary UI is usually a sibling `*Page.tsx` / `*.tsx` in the same folder.

| URL path (app route) | Area |
|---------------------|------|
| `/` (redirect / landing) | [apps/web/src/app/page.tsx](../apps/web/src/app/page.tsx) |
| `/apps` | Apps hub |
| `/apps/settings`, `/apps/settings/account`, `security`, `notifications`, `plan-billing`, `team` | Fuse Settings templates (**API:** mostly `/api/mock/...` in [SettingsApi.ts](../apps/web/src/app/(control-panel)/apps/settings/SettingsApi.ts)) |
| `/apps/settings/users`, `.../new`, `.../[userId]` | Users admin ([UsersApi.ts](../apps/web/src/app/(control-panel)/apps/settings/users/UsersApi.ts)) |
| `/apps/profile`, `edit`, `change-password` | Profile / password |
| `/apps/contacts`, `.../[contactId]`, `view`, `edit` | Contacts demo (**API:** mock in [ContactsApi.ts](../apps/web/src/app/(control-panel)/apps/contacts/ContactsApi.ts)) |
| `/apps/notifications` | In-app notifications ([NotificationApi.ts](../apps/web/src/app/(control-panel)/apps/notifications/NotificationApi.ts)) |
| `/company-profile` | Company / tenant profile (**API:** `GET /api/users/me` + `PUT /api/tenants/update-my-company-info` after parity fix) |
| `/dashboards`, `/dashboards/project`, `/dashboards/analytics` | Dashboards |
| `/dashboards/project/daily-sales`, `.../[date]` | Daily sales drill-down |
| `/trading/newsale`, `/trading/pending`, `/trading/sales`, `/trading/sales/[orderId]` | Sales |
| `/trading/sales/returns`, `.../new`, `.../[id]` | Sales returns |
| `/trading/newpurchase`, `/trading/purchases`, `/trading/purchases/[purchaseId]` | Purchases |
| `/trading/purchases/returns`, `.../new`, `.../[id]` | Purchase returns |
| `/inventory`, `/inventory/products`, `/inventory/products/[slug]/[[...handle]]` | Products |
| `/inventory/categories`, `.../[categoryId]/[[...handle]]` | Categories |
| `/inventory/transactions` | Transactions |
| `/inventory/transfers`, `/inventory/newtransfer`, `.../[transferId]/[[...handle]]` | Transfers |
| `/inventory/adjustquantities`, `.../new` | Adjust quantities (separate UX from `/inventory/adjustments`) |
| `/inventory/adjustments`, `.../[adjustmentsId]/[[...handle]]` | Adjustment records |
| `/inventory/stock-count`, `.../new` | Stock count |
| `/inventory/reorder`, `/inventory/expiring` | Reorder / expiring |
| `/expenses`, `/expenses/[expenseId]/[[...handle]]` | Expenses |
| `/users/customers`, `.../[contactId]`, `view`, `edit`, `payments`, `transactions` | Customers |
| `/setups/suppliers`, `.../[supplierId]/[[...handle]]`, `view`, `supplies` | Suppliers |
| `/setups/locations`, `.../[locationId]/[[...handle]]` | Locations |
| `/setups/warehouses`, `.../[warehouseId]/[[...handle]]` | Warehouses |
| `/subscription`, `/subscription/payment`, `.../card`, `/subscription/payments` | Subscription / Paystack |

**Full file list (74 `page.tsx` files):** under [apps/web/src/app/(control-panel)](../apps/web/src/app/(control-panel)).

## 2. Cheqstack screens

### Auth & subscription navigators

| Navigator | Screens |
|-----------|---------|
| [auth.js](../apps/mobile/src/navigators/auth.js) | GetStarted, Login, ForgotPassword, CompanyDetailsSetup, ResetPassword |
| [subscription.js](../apps/mobile/src/navigators/subscription.js) | Subscription, Payment, PaymentHistory, PaymentWebView, PaymentInvoice, MomoProcessing, MomoStatus |

### Main stack ([main.js](../apps/mobile/src/navigators/main.js))

`Stack.Screen` names (each maps to `containers/home/*` or `containers/settings/*`):  
Home (tab), SaleDetails, PurchaseDetails, ProductDetails, ProductTransactions, ProductForm, ProductImport, Profile, ProfileForm, ResetPassword, CompanyProfile, Warehouses, Customers, Expenditures, Suppliers, Reports, StockSummary, ReportDetail, NotificationsSetup, Subscription, Payment, PaymentHistory, PaymentWebView, MomoProcessing, MomoStatus, PaymentInvoice, AboutApp, Notifications, Search, BarcodeScanner, NewSale, NewPurchase, ProductTransfers, AdjustedQuantities, ProductCategories, NewTransfer, NewAdjustments, PendingSales, CategoryForm, ProductsByCategory, CreateWarehouse, EditWarehouse, CreateLocation, AdjustmentDetails, TransferDetails, CustomerDetails, CustomerSale, CustomerPayments, CustomerPaymentDetails, SupplierDetails, SupplierForm, SupplierSupplies, ExpenditureDetails, CreateExpenditure, TransactionDetails, CustomerForm, InvoiceReceiptSettings, DataExportBackup, Returns, NewSaleReturn, NewPurchaseReturn, ReturnDetails, ReturnItems, StockCount, StockCountHistory, StockCountDetails, ItemsToReorder, ExpiringSoon, **PurchaseOrders**, **CreatePurchaseOrder**, **PurchaseOrderDetails**, **ReceiveAgainstPO**, Users, Roles, UserDetails, UserForm, AuditLogDetails, DailySales, DaySalesList.

### Tabs ([main.js](../apps/mobile/src/navigators/main.js) `HomeStackScreen`)

| Tab | Permission gate (`canAccessScreen`) |
|-----|-------------------------------------|
| Dashboard | `Dashboard` → `dashboard.view` |
| Inventory | `Inventory` → `inventory.view` |
| Sales | `Sales` → `sales.view` |
| Purchases | `Purchases` → `purchases.view` |
| More | `More` → `settings.view` |

## 3. Web ↔ mobile feature matrix (summary)

Status: **matched** (same capability via API), **partial** (API or UX gap), **web_only**, **mobile_only**, **N/A**.

| Feature area | Web | Mobile | Status |
|--------------|-----|--------|--------|
| Login / forgot / reset | `(public)/sign-in`, forgot-password | auth navigator | matched |
| Dashboard project / analytics | `/dashboards/*` | Dashboard + reports | partial (compare metrics/widgets) |
| Daily sales | `/dashboards/project/daily-sales` | DailySales, DaySalesList | matched |
| New sale, sales list, detail | `/trading/*` | NewSale, Sales, SaleDetails | matched |
| Pending / offline sales | `/trading/pending` | PendingSales + secure queue | partial (mobile offline; web list UX) |
| Sales returns | `/trading/sales/returns` | Returns, NewSaleReturn, ReturnDetails | matched |
| Purchases | `/trading/newpurchase`, purchases list/detail | NewPurchase, Purchases, PurchaseDetails | matched |
| Purchase returns | `/trading/purchases/returns` | NewPurchaseReturn, etc. | matched |
| Purchase orders | — | PurchaseOrders*, Create*, Details, Receive* | **mobile_only** |
| Products / categories | `/inventory/products`, categories | Inventory, ProductForm, ProductCategories, etc. | matched |
| Transactions | `/inventory/transactions` | ProductTransactions, TransactionDetails | matched |
| Transfers | `/inventory/transfers`, newtransfer | ProductTransfers, NewTransfer, TransferDetails | matched |
| Adjust quantities (history + new) | `/inventory/adjustquantities` | AdjustedQuantities, NewAdjustments, AdjustmentDetails | partial (web has two entry paths: see adjustments row) |
| Adjustments list/detail | `/inventory/adjustments` | AdjustmentDetails | partial (naming/routing alignment) |
| Stock count | `/inventory/stock-count` | StockCount*, StockCountHistory, StockCountDetails | matched |
| Reorder / expiring | `/inventory/reorder`, `/inventory/expiring` | ItemsToReorder, ExpiringSoon | matched |
| Expenses | `/expenses` | Expenditures, CreateExpenditure, ExpenditureDetails | matched |
| Customers + payments/tx | `/users/customers/*` | Customers*, CustomerPayments, CustomerSale | matched |
| Suppliers + supplies | `/setups/suppliers/*` | Suppliers*, SupplierSupplies | matched |
| Locations | `/setups/locations` | CreateLocation, (list via settings) | partial (entry points differ) |
| Warehouses | `/setups/warehouses` | Warehouses, CreateWarehouse, EditWarehouse | matched |
| Subscription / payments | `/subscription/*` | Subscription navigator + Payment* | matched |
| Company profile | `/company-profile` | CompanyProfile + `tenants.updateMyCompanyInfo` in api | partial (web fixed to IMS API; mobile UI may still be stub) |
| Settings: Account / Security / Notifications / Plan / Team | `/apps/settings/*` | Profile*, ResetPassword, NotificationsSetup, Subscription | **partial** — web still uses **mock** SettingsApi for Fuse pages; mobile uses real `/users/me`, preferences, payments where implemented |
| Settings: Users (CRUD) | `/apps/settings/users` | Users, UserForm, UserDetails | matched |
| Team (Fuse template) | `/apps/settings/team` | Roles, Users (overlap) | partial — align product intent |
| Apps contacts (demo) | `/apps/contacts` | — | **web_only** (mock API) |
| Apps notifications list | `/apps/notifications` | Notifications | partial (same `/notifications` API possible) |
| Audit log detail | — | AuditLogDetails | **mobile_only** (or buried in web) |
| Barcode / search | — (may exist in web product pages) | BarcodeScanner, Search | partial |
| Data export backup | — | DataExportBackup | **mobile_only** |
| Invoice / receipt settings | — | InvoiceReceiptSettings | **mobile_only** |

## 4. API alignment notes (api-diff)

- **Shared IMS paths:** Web RTK endpoints in `*Api.ts` files and mobile [api.js](../apps/mobile/src/services/api.js) should prefer the same routes documented in API.md.
- **Transfers:** API.md lists both `/api/transfers` and `/api/products/transfers`. Web [ECommerceApi.ts](../apps/web/src/app/(control-panel)/inventory/ECommerceApi.ts) uses `/api/products/transfers`; mobile uses `/transfers` — both valid; keep payloads compatible.
- **Company profile:** Previously web called non-documented `/api/company-profile`. Updated to **`GET /api/users/me`** (map `company` → form) and **`PUT /api/tenants/update-my-company-info`** (map `companyName` → `name`, plus address/phone/email/website).
- **Settings (Fuse):** [SettingsApi.ts](../apps/web/src/app/(control-panel)/apps/settings/SettingsApi.ts) still uses `/api/mock/*`. Replacing with real routes requires mapping Fuse field shapes to `users/me`, `users/me/preferences`, `users/change-password`, `subscriptions/current`, `payments`, `user-management/*` — tracked as follow-up.
- **Customers contacts mock:** [ContactsApi.ts](../apps/web/src/app/(control-panel)/users/customers/ContactsApi.ts) still references `/api/mock/contacts/*` for tags; customer CRUD uses `/api/customers`.
- **User delete:** API.md says `DELETE /api/users/:id`; ims-services uses **`PUT /api/users/:id/delete`**. Mobile [api.js](../apps/mobile/src/services/api.js) matches backend.

**Automated endpoint inventory:** run [scripts/parity-collect-api-paths.mjs](../scripts/parity-collect-api-paths.mjs).

## 5. Permissions (permissions-diff)

| Web | Mobile |
|-----|--------|
| [authRoles](../apps/web/src/@auth/authRoles.ts): `admin`, `staff`, `user`, `onlyGuest` | [permissions.js](../apps/mobile/src/utils/permissions.js): `hasPermission` / `canAccessScreen`, Admin short-circuit |
| Nav `auth: authRoles.admin` on inventory group, purchases, setups ([navigationConfig.ts](../apps/web/src/configs/navigationConfig.ts)) | Tab + stack gates: e.g. `purchases.view`, `inventory.view`, `settings.view` |
| Fuse route guards (session + role) | Backend permission codes on `user.settings.permissions`; empty list **allows** (legacy fallback) |

**Recommendations**

1. Treat **admin-only nav** on web (inventory group, purchases, setups) as the product rule; ensure mobile hides or locks matching `Stack.Screen` navigations for non-admin unless explicit permissions exist (today many screens rely on `hasPermission` with empty = allow).
2. Extend `SCREEN_PERMISSION_MAP` for **PurchaseOrders** and **DataExportBackup** if they should not be admin-only.
3. Document which web **staff** / **user** roles correspond to which permission codes in seed data ([apps/api/seed-permissions.sql](../apps/api/seed-permissions.sql)).

## 6. Intentional asymmetry (product decisions)

| Item | Notes |
|------|------|
| Purchase orders | Mobile-only stack until ims-web adds equivalent routes. |
| Fuse Settings mocks | Web-only placeholder data until wired to IMS. |
| `apps/contacts` | Web demo / mock; real CRM path is `/users/customers`. |
| Pending sales offline | Mobile-only resilience; web `/trading/pending` expects online behavior unless extended. |
| `DataExportBackup`, `InvoiceReceiptSettings`, `AuditLogDetails` | Evaluate port to web or mark mobile-only. |

## 7. Manual verification checklist (verify-by-journey)

Run both apps against the same `BASE_API` / environment. For each journey: **happy path** + **one failure** (validation or 4xx).

| # | Journey | Web entry | Mobile entry |
|---|---------|-----------|--------------|
| 1 | Auth | sign-in, forgot password | Login, ForgotPassword |
| 2 | Session / me | reload dashboard | cold start → Main |
| 3 | Company profile | `/company-profile` | CompanyProfile / setup flow |
| 4 | Dashboards | project + analytics | Dashboard |
| 5 | New sale → list → detail | newsale → sales | NewSale → Sales → SaleDetails |
| 6 | Pending sales | `/trading/pending` | PendingSales |
| 7 | Returns (sale / purchase) | trading returns | Returns |
| 8 | Purchase flow | newpurchase | NewPurchase |
| 9 | Products + inventory | products | Inventory, ProductForm |
| 10 | Transfers | transfers | ProductTransfers |
| 11 | Adjustments / adjust quantities | adjustquantities + adjustments | AdjustedQuantities, NewAdjustments |
| 12 | Stock count | stock-count | StockCount |
| 13 | Reorder / expiring | reorder, expiring | ItemsToReorder, ExpiringSoon |
| 14 | Expenses | expenses | Expenditures |
| 15 | Customers / suppliers | users/customers, setups/suppliers | Customers, Suppliers |
| 16 | Locations / warehouses | setups/* | Warehouses, CreateLocation |
| 17 | Subscription / pay | subscription | Subscription, Payment |
| 18 | Users / roles | apps/settings/users | Users, Roles |
| 19 | Notifications | apps/notifications | Notifications |

---

_Last updated as part of parity implementation; do not treat API.md contradictions (e.g. DELETE user) as blockers without checking ims-services routes._
