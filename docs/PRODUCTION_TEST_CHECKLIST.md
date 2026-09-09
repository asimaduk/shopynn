# Production-test release checklist

Use this before handing Cheqstock (mobile) + ims-services to testers or a staging environment.

**Security hardening (emulator block, TLS pinning, R8, etc.):** see [ANDROID_RELEASE_SECURITY.md](./ANDROID_RELEASE_SECURITY.md).

**iOS release build & TestFlight prep:** see [IOS_RELEASE_PREP.md](./IOS_RELEASE_PREP.md).

**User types and how to create accounts:** see [USER_TYPES_AND_CREATION.md](./USER_TYPES_AND_CREATION.md).

**Order payments, settlements & Paystack withdrawals UAT:** see [UAT_ORDER_SETTLEMENTS.md](./UAT_ORDER_SETTLEMENTS.md).

## Deploy backend (ims-services)

- [ ] Deploy API build that includes `notificationroutes.js` (`requireAnyPermission` for staff inbox: `notifications.view`, `notifications.mark_read`, `notifications.settings.view`).
- [ ] Run pending SQL migrations (in order, on target DB):
  - `20260520_order_installments.sql`
  - `20260521_email_verification_codes.sql`
  - `20260522_payments_view_premium_only.sql`
  - `20260523_super_admin_strip_customer_portal_perms.sql`
  - `20260524_free_tier_products_create.sql`
  - `20260525_online_orders_premium_only.sql`
  - `20260526_billing_catalog_onboarding_quotes.sql` (billing catalog, onboarding quotes, merchant one-charge checkout)
- [ ] Re-run or verify `seed-permissions.sql` if permissions/plan features changed on an existing environment.
- [ ] Confirm API base URL matches mobile `PRODUCTION_TEST_API` in `apps/mobile/src/config/index.js`.

## Mobile build (shopynn)

- [ ] **Release build** uses production HTTPS API; **dev** (`__DEV__`) uses `LOCAL_DEV_API` — update both URLs in `config/index.js` if your host changed.
- [ ] Bump `VERSION_NUMBER` in `config/index.js` if testers need to distinguish builds.
- [ ] **Android:** release APK/AAB (not only Metro dev); `applicationId` is `com.shopynn`. See [ANDROID_RELEASE_SECURITY.md](./ANDROID_RELEASE_SECURITY.md).
- [ ] **iOS:** Archive with scheme **Shopynn** / Release; replace Firebase configs for `com.shopynn`. See [IOS_RELEASE_PREP.md](./IOS_RELEASE_PREP.md).
- [ ] No `[Login]` or login error `console.log` noise in release (guarded/removed); iOS still logs every API URL in `interceptors.js` — gate with `__DEV__` before wide test.

## Smoke tests (Super Admin / Premium-style tenant)

- [ ] Login → lands on expected home tab (dashboard or merchant clients tab).
- [ ] **Notifications** — inbox loads (not “Premium plan required”); mark one read; open settings if `notifications.settings.view`.
- [ ] **Tenant directory** — list, search, detail (stats, recent payments).
- [ ] **Order payments** — list loads for `payments.view` + feature.
- [ ] **Daily sales** — Premium feature gate OK when entitled.
- [ ] **Merchants** portal — list/detail if permitted.
- [ ] **Subscription** — view plan; upgrade flow if billing admin.
- [ ] Sign out → login again (token refresh / session).

## Smoke tests (Basic / Standard tenant)

- [ ] Customer **online orders** blocked on Free/Basic/Standard (per `docs/PRICING_PACKAGES.md`).
- [ ] **Order payments** / **notifications inbox** show upgrade prompt when plan lacks feature.
- [ ] Core inventory, sales, purchases still work per role permissions.

## Regression

- [ ] Search toggle on list screens (customers, suppliers, tenant directory, etc.).
- [ ] New transfer: cannot select same From/To warehouse.
- [ ] Offline: no crash on cold start after prior session (optional).

## Known config notes

- `LOCAL_PRINT_URL` defaults to `127.0.0.1` — physical devices need your machine LAN IP for receipt printing tests.
- Super Admin does **not** have B2C `notifications.view` permission; staff inbox uses `notifications.mark_read` / `notifications.settings.view` plus plan feature `notifications.view`.
