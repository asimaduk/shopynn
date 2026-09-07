# Tenant onboarding and go-live checklist

This guide describes how a new **tenant** (business) is created in IMS, what the system sets up automatically, and what operators should do afterward so the business can use the web and mobile apps.

---

## 1. Environment and database prerequisites

Before anyone can onboard:

1. **Schema** — Apply `schema.sql` (or your migration chain) to PostgreSQL.
2. **Permissions** — Run `seed-permissions.sql`.  
   Onboarding assigns almost all permissions to the first user’s **tenant-scoped “Super Admin”** role. If `permissions` is empty, role setup will not grant access to features.
3. **Optional:** `seed-roles.sql` — Inserts **system** roles (`tenant_id` null). Tenant onboarding **does not** rely on these; it creates a **new** role per tenant named **Super Admin** with a new UUID.
4. **Optional:** `industries.sql` (or `/api/industries`) — Lets you set `industry_id` on the tenant later for reporting and company profile.
5. **Email** — Configure mail so **“Account created”** messages can be sent when the owner is created with a generated or supplied password (`user` model sends credentials for manual registration).

---

## 2. Primary onboarding API (self-serve signup)

**Endpoints (both run the same service today):**

- `POST /api/tenants/setup` *(public)*  
- `POST /api/tenants` *(public)*  

Both call `createTenantService`: **tenant → subscription → first user** in one transactionally safe sequence (see `src/models/tenant.js`).

### Required fields

| Field | Notes |
|--------|--------|
| `subscription_type` | **Required.** `1` = Free (14 days), `2` = Basic, `3` = Standard, `4` = Premium (paid plans use billing amounts defined in `subscription.js`). |
| `first_name`, `last_name` | Owner (first user). |
| `email` **or** `owner_email` | Login email for the owner (normalized to lowercase). Must be unique among `users`. |
| `verification_token` | **Required** for public self-serve signup (Shopynn landing, Cheqstock app). Obtain via `POST /api/users/shop-owner-signup/verify-email-otp` after OTP is sent to `owner_email`. Not required when a merchant partner onboards a business (internal skip). |
| `phone` | **Tenant** contact phone; must not duplicate another tenant’s phone when provided. |
| `name` | Tenant / business display name (stored even if validation comments in code are loose). |

### Common optional fields

- **Tenant:** `organization`, `notes`, `address`, `city`, `state`, `country`, `postal_code`, `website`, `logo`, `email`, `product_categorization`, `industry_id`, `creator_id` (if you track who created the tenant).
- **Owner user:** `owner_phone` (user phone; falls back to tenant phone when omitted in logic), `registration_method` (e.g. `manual`), `password` (if omitted for manual signup, a temporary password may be generated and emailed).

### What the backend creates automatically

1. **`tenants`** row.  
2. **`subscriptions`** row and link on the tenant (`subscription_id`).  
   - **Free (`subscription_type = 1`):** `status = active`.  
   - **Basic / Standard / Premium:** `status = pending` until payment succeeds. **`activatePendingSubscriptionService`** runs automatically when Paystack reports success (verify, OTP submit, or webhook) on a **subscription** payment (no `order_id`); `PUT /api/subscriptions/:id/activate` remains available for manual use.  
3. **First user** via `createUserService` with **`isOnboarding: true`** (`src/models/user.js`):
   - **`warehouses`** — “**Main warehouse**” for that tenant; user’s `warehouse_id` is set; warehouse `creator_id` updated to that user.
   - **`roles`** — One **tenant-scoped** role: **Super Admin**.
   - **`role_permissions`** — All tenant-staff permissions **except** platform codes (`merchants.*`, `tenants.directory.view`, marketing inbox codes) and **customer-portal** codes (`orders.view`, `orders.create`, `orders.details.view`, `orders.cancel`, `notifications.view` for the B2C **Customer** role only). Staff store-order access uses `orders.store.*`, `orders.process`, etc.
   - **`user_roles`** — That user is assigned **Super Admin**, `assigned_by` = self (or assigner when applicable).

### Response

Typical success payload includes **`tenant`**, **`subscription`** summary, and **`user.id`** for the owner.

---

## 3. First login and subscription gate

Most business endpoints use **`auth`** plus **`requireActiveSubscription`** (`src/middleware/requireActiveSubscription.js`): the tenant must have a linked subscription and valid **`start_at` / `end_at`** window.

- New **Free** tenants are usually able to call these APIs immediately.  
- **Paid** tiers created as **`pending`** may need **activation** (and correct dates) before `requireActiveSubscription` allows access—align this with your **payments webhook** or admin process.

**Login:** `POST /api/users/login` with email + password.

If the owner received a **temporary password**, the app flow should prompt for **change password** (`change-password` / `reset-password` endpoints per `docs/API.md`).

---

## 4. Post-onboarding: complete company setup (logged-in owner)

After the owner can authenticate and pass subscription checks:

| Step | How |
|------|-----|
| Company profile & industry | `PUT /api/tenants/update-my-company-info` with address, logo, `industry_id`, etc. *(requires auth + active subscription)* |
| Industries list | `GET /api/industries` *(auth + subscription)* — pick `industry_id` if not set at signup |
| Extra stores | `POST /api/warehouses` (and optionally assign staff `warehouse_id`) |
| Catalog | Categories and products via `/api/categories`, `/api/products` |
| Staff | `POST /api/users` with `role_id`, `warehouse_id`, and permission sets per your **User management** / roles UI |
| Subscription & billing | `GET /api/subscriptions/current`, `/api/payments/*` as implemented |

---

## 5. Merchant / partner–assisted onboarding (optional)

If a **merchant partner** onboards linked businesses:

- **`POST /api/merchants/onboard`** *(authenticated, merchant middleware + `merchants.operate` or `merchants.view`)* — wraps the same tenant creation / commission logic used for partner-led signup (`merchantroutes.js`).

This is separate from the **public** `POST /api/tenants/setup` path used for direct signup.

---

## 6. Operational checklist (summary)

| # | Task |
|---|------|
| 1 | DB schema + **`seed-permissions.sql`** applied |
| 2 | Email (or other) delivery works for welcome / temp password |
| 3 | Call **`POST /api/tenants/setup`** (or `/api/tenants`) with `subscription_type`, tenant fields, owner name + email |
| 4 | Confirm **`subscriptions`** state for paid plans (activate when payment succeeds) |
| 5 | Owner logs in, changes password if needed |
| 6 | Set **industry**, company details, **warehouses**, **products**, **extra users** |

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Owner has no access to menus / 403 on APIs | **`permissions`** not seeded, or **`role_permissions`** incomplete for the tenant’s Super Admin role. Re-run permission seeds; for an existing role, bulk-insert from `permissions` as needed. |
| `403` “No active subscription” | Tenant missing `subscription_id`, dates invalid, or paid plan still **pending** without activation. |
| Duplicate email / phone errors | Same `users.email` / `users.phone` or tenant phone already used—choose unique values. |
| Company “industry” shows **Not set** | `industry_id` null on tenant—set via company update API once industries exist. |

For HTTP details and more routes, see **`docs/API.md`**.
