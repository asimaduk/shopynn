# Pricing & packages (Ghana)

Budget-friendly monthly tiers (Ghana), hosting included, WhatsApp support.

## Monthly subscription (GHS)

### Starter (Basic) — GHS 149 / month
- Best for: single store getting started
- Includes: core inventory, products, sales (incl. receipt sharing), purchases, customers & suppliers (create/edit), payments & subscription viewing
- Limits: 1 branch, up to 3 users
- Support: business-hours WhatsApp support

### Business (Standard) — GHS 349 / month
- Best for: multi-branch operations needing controls
- Includes: everything in Starter, plus multi-store access, transfers, adjustments, **stock counts**, reorder/expiring insights, users/roles/permissions, locations, purchase orders workflow, reports (view), **notifications**
- Limits: up to 5 branches, up to 12 users
- Support: business-hours WhatsApp support

### Scale (Premium) — GHS 649 / month
- Best for: full platform + customer ordering
- Includes: everything in Business, plus Orders/customer ordering, exports & data export, audit logs, advanced order analytics/automation
- Limits: up to 10 branches, up to 25 users (custom for larger teams)
- Support: priority WhatsApp support

## One-time assisted go-live (GHS, optional)

Includes product import (CSV) and opening stock setup for a typical shop.

- Basic assisted go-live: **GHS 500**
- Standard assisted go-live: **GHS 1,300**
- Premium assisted go-live: **GHS 2,000**
- Self-serve (owner sets up alone): **GHS 0**

**Add-ons (true extras only):**

- Data migration from another system: catalog price (default **GHS 3,000**)
- Extra training day: catalog price (default **GHS 1,000**)
- Thermal printer setup alone: **GHS 150** (included free with assisted go-live)

### Unlocking thermal printer in the app

Thermal print is a **core feature** — self-serve shops may enable it free when they set it up themselves.

Setting a store to **Thermal receipt** is blocked **only if** the shop has a **pending** paid-assistance quote (assisted go-live or printer-setup add-on) that is not yet paid. After payment (or if they never requested help), thermal is allowed.

| Situation | Thermal |
|-----------|---------|
| Self-serve DIY, no assistance quote | Allowed |
| Pending assisted go-live or printer add-on | Locked until paid |
| Paid assisted go-live or printer add-on | Allowed |

API: `GET /api/tenants/me/printer-setup-entitlement` · warehouse create/update returns `403` + `PRINTER_SETUP_PAYMENT_REQUIRED` when locked.

## Notes

- Hosting is included in the subscription.
- 12-month commitments can be discounted (optional).

## Mid-cycle upgrades (proration)

When a tenant upgrades to a **higher** paid tier while their current plan is still **active**:

1. Remaining time on the old plan is valued in GHS: `remaining_days × (old_monthly_price / period_days)`.
2. That value is converted to days on the new plan: `credit_value ÷ (new_monthly_price / period_days)`.
3. After successful payment, the new plan is active for **one full billing period plus those bonus days** (`end_at`).

Example: 10 days left on Starter (GHS 149 / 30 days) ≈ GHS 49.67 credit → about **4.3 extra days** on Business (GHS 349 / 30 days), on top of the new 30-day term.

The current plan stays active until checkout completes. Downgrades are not supported via this flow.

