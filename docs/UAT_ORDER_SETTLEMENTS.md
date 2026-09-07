# UAT — Order payments, settlements & Paystack withdrawals

Use this document for user acceptance testing of **digital order revenue**, **store-order cash handling**, and **merchant withdrawals** on **ims-web** and **Cheqstock**.

**Related:** [CHEQSTOCK_IMS_WEB_PARITY.md](./CHEQSTOCK_IMS_WEB_PARITY.md) · [apps/mobile/docs/INSTALLMENTS.md](../apps/mobile/docs/INSTALLMENTS.md) · [apps/api/docs/API.md](../apps/api/docs/API.md)

Run UAT on **staging** with Paystack **test** keys first, then a short **production smoke** before go-live.

---

## 1. Scope

| In scope | Out of scope |
|----------|----------------|
| Digital order payments (card/MoMo via Paystack) | Paystack subscription billing for Shopynn plans |
| Cash / pay-over-time on store orders (staff) | Automatic Paystack split at checkout |
| Settlement balance & withdrawal (MoMo/bank) | Tax / fee invoicing |
| Paystack auto-transfer on withdraw | Multi-currency |
| Admin settlement / withdrawal monitoring | |

**Surfaces:** ims-web (control panel) + Cheqstock (mobile)

---

## 2. Prerequisites

### 2.1 Environment

- [ ] `apps/api` (`@shopynn/api`) deployed and reachable from web + mobile
- [ ] DB migrations applied (in order):
  - `apps/api/migrations/20260528_tenant_order_settlements.sql`
  - `apps/api/migrations/20260529_tenant_payout_profiles_and_withdrawals.sql`
  - `apps/api/migrations/20260530_paystack_auto_withdrawals.sql`
- [ ] `PAYSTACK_SECRET_KEY` set (test key for UAT)
- [ ] Paystack **Transfers** enabled on the business account
- [ ] Paystack balance funded (test or live)
- [ ] Webhook URL: `POST {API_BASE}/api/payments/webhook`
  - Events: `charge.success`, `charge.failed`, `transfer.success`, `transfer.failed`, `transfer.reversed`
- [ ] Optional: `PAYSTACK_MIN_WITHDRAWAL_GHS=1`
- [ ] Optional: `PAYSTACK_AUTO_WITHDRAWAL=false` to test manual admin approval path

### 2.2 Test accounts

| Role | Plan | Permissions | Purpose |
|------|------|-------------|---------|
| **Owner A** | Premium | `payments.view`, order management | Withdrawals, settlements |
| **Staff A** | Premium | `orders.status.update`; may lack `payments.view` | Cash payment on orders |
| **Owner B** | Basic or Standard | — | Verify feature gating |
| **Platform admin** | — | `tenants.directory.view` | Withdrawal queue, tenant settlements |

See [USER_TYPES_AND_CREATION.md](./USER_TYPES_AND_CREATION.md) for account setup.

### 2.3 Test data

- [ ] At least one **store** with products
- [ ] At least one **online order** paid digitally (Paystack test card/MoMo)
- [ ] Optional: one **pay-over-time** order with balance due
- [ ] Optional: one **cash** order (must not affect settlement balance)

---

## 3. How to record results

Use this matrix while testing:

| ID | Scenario | Web | Mobile | Pass? | Notes |
|----|----------|-----|--------|-------|-------|
| UAT-01 | … | | | ☐ | |

**Pass** = matches expected behavior on all required surfaces. **Fail** = log steps, screenshot, API response, and Paystack dashboard reference.

---

## 4. Digital order payments (money in)

### UAT-01 — Customer pays online (Paystack)

**Actor:** Customer  
**Pre:** Product live, checkout enabled

1. Place order and pay with Paystack (test card or MoMo).
2. Complete payment on Paystack.

**Expected:**

- Order `payment_status` = paid
- Payment record exists with non-cash method
- Amount included in tenant **Digital collected** (after webhook or verify)

---

### UAT-02 — Owner views order payments

**Actor:** Owner A (Premium)

1. Open **Order Payments** (web: Trading → Order Payments; mobile: Settings).
2. Find the digital payment from UAT-01.

**Expected:**

- Payment listed with correct amount, method, status
- Navigation to **Order Settlements** works

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-03 — Cash does not affect settlement balance

**Actor:** Staff A

1. Complete a **cash** store order (mark paid in cash on order details).
2. Owner opens **Order Settlements**.

**Expected:**

- Cash payment does **not** increase **Digital collected** or **Available balance**

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

## 5. Staff: cash & partial payments (store orders)

### UAT-04 — Mark order paid (cash)

**Actor:** Staff A  
**Pre:** Pickup order at `completed` (or delivery `delivered` / `completed`), unpaid

1. Open **Order details**.
2. Use **Mark paid (cash)**.

**Expected:**

- Order marked paid
- No Paystack transfer triggered
- Settlement balance unchanged

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-05 — Record partial cash (pay-over-time)

**Actor:** Staff A  
**Pre:** Installment order, `balance_due > 0`

1. Enter partial amount ≤ balance.
2. **Record cash payment**.

**Expected:**

- `amount_paid` increases, `balance_due` decreases
- Installment line visible on order
- Settlement balance unchanged

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-06 — Permission gating (staff)

**Actor:** Staff without `orders.status.update`

1. Open order details for unpaid order.

**Expected:**

- No cash / partial payment actions shown

---

## 6. Payout profile (one-time setup)

### UAT-07 — Save MoMo payout details

**Actor:** Owner A

1. **Order Settlements** → Payout details.
2. Method: **Mobile money** — MTN (or Telecel / AT), valid number, holder name.
3. **Save payout details**.

**Expected:**

- Success message
- “Saved destination” shows network + number
- Profile persists after refresh

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-08 — Save bank payout details

**Actor:** Owner A

1. Method: **Bank transfer**.
2. Select bank from list (web dropdown; mobile searchable picker).
3. Enter account number + account name.
4. Save.

**Expected:**

- Bank saved correctly
- Saved destination shows bank + account

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-09 — Update payout details

**Actor:** Owner A

1. Change MoMo number (or bank account).
2. Save again.
3. Run a small test withdrawal.

**Expected:**

- New details saved
- Withdrawal sent to **new** destination

---

## 7. Withdrawals (redeem earnings)

### UAT-10 — View settlement summary

**Actor:** Owner A  
**Pre:** At least one successful digital order payment

1. Open **Order Settlements**.

**Expected:**

- **Digital collected** > 0
- **Available balance** = collected − paid − pending/processing
- UI states cash is excluded

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-11 — Successful withdrawal (Paystack)

**Actor:** Owner A  
**Pre:** Payout profile saved; available balance ≥ minimum (default GHS 1)

1. Enter amount ≤ available balance.
2. **Withdraw via Paystack**.

**Expected:**

- Status **Processing** or **Paid**
- **Available balance** reduced by amount
- History row with Paystack reference
- Transfer visible in Paystack dashboard; funds on test MoMo/bank if applicable

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-12 — Withdraw more than available balance

**Actor:** Owner A

1. Enter amount > **Available balance**.
2. Submit.

**Expected:**

- Clear error; balance not incorrectly reserved

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-13 — Withdraw without payout profile

**Actor:** Owner A (no profile saved)

1. Attempt withdraw without saving payout details.

**Expected:**

- Button disabled or error prompting payout setup

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-14 — Concurrent withdrawal blocked

**Actor:** Owner A

1. Start a withdrawal that remains **Processing**.
2. Attempt a second withdrawal before the first completes.

**Expected:**

- Error: withdrawal already in progress

---

### UAT-15 — Failed withdrawal + retry

**Actor:** Owner A  
**Pre:** Force failure (invalid MoMo in test, or insufficient Paystack balance)

1. Submit withdrawal → **Failed** with reason.
2. Fix payout details if needed.
3. **Retry payout** on the failed row.

**Expected:**

- Failed row shows reason
- Balance not permanently locked
- Retry triggers new Paystack attempt; status updates

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-16 — Webhook: processing → paid

**Actor:** System  
**Pre:** Withdrawal in **Processing**

1. Confirm Paystack sends `transfer.success` to webhook.
2. Refresh settlements.

**Expected:**

- Status → **Paid**; `paid_at` and reference stored

---

## 8. Plan & permission gating

### UAT-17 — Non-Premium owner blocked

**Actor:** Owner B (Basic / Standard)

1. Attempt to open Order Settlements / Order Payments.

**Expected:**

- Locked nav or upgrade prompt; no full access

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-18 — Premium owner access

**Actor:** Owner A

**Expected:**

- Order Payments and Order Settlements visible and usable

---

## 9. Platform admin

### UAT-19 — Withdrawal requests queue

**Actor:** Platform admin

1. Web: **Admin Tools → Withdrawal requests**.
2. Filter: **Processing**, **Failed**, **Awaiting review** (manual mode only).

**Expected:**

- Merchant withdrawals listed with tenant, amount, destination, Paystack ref
- Processing / failed states show helpful copy

| Web only |

---

### UAT-20 — Tenant directory settlements

**Actor:** Platform admin

1. Open tenant in **Tenant directory** (web dialog or mobile detail).
2. Review settlements section.

**Expected:**

- Summary cards match tenant balance
- History shows merchant withdrawals and statuses

| Web | Mobile |
|-----|--------|
| ✓ | ✓ |

---

### UAT-21 — Manual settlement path (fallback)

**Actor:** Platform admin  
**Pre:** `PAYSTACK_AUTO_WITHDRAWAL=false` or legacy **Requested** withdrawal

1. Approve requested withdrawal (if applicable).
2. Pay merchant offline.
3. **Mark paid** with payout reference.

**Expected:**

- Status **Paid**; ledger correct

---

## 10. Regression

| ID | Check | Pass? |
|----|--------|-------|
| UAT-22 | Subscription Paystack checkout still works (`charge.success` webhook) | ☐ |
| UAT-23 | Order status workflow unchanged (pickup/delivery → cash mark paid) | ☐ |
| UAT-24 | Web and mobile show same balance after identical actions | ☐ |
| UAT-25 | Refresh / pull-to-refresh updates settlement history | ☐ |

---

## 11. 15-minute smoke (before go-live)

1. One digital order payment → appears in Order Payments.
2. Save MoMo payout profile.
3. Withdraw minimum amount → **Paid** or **Processing**; confirm on Paystack.
4. Owner B sees locked settlements.
5. Admin sees withdrawal in queue.

---

## 12. Sign-off

| Field | Value |
|-------|--------|
| Environment | Staging / Production |
| Build / commit | |
| Paystack mode | Test / Live |
| UAT lead | |
| Date | |

| Area | Tester | Result | Blockers |
|------|--------|--------|----------|
| Digital payments in | | Pass / Fail | |
| Cash on orders | | Pass / Fail | |
| Payout profile | | Pass / Fail | |
| Auto withdrawal | | Pass / Fail | |
| Retry / failures | | Pass / Fail | |
| Admin monitoring | | Pass / Fail | |
| Gating / permissions | | Pass / Fail | |

**Release recommendation:** ☐ Go · ☐ Go with conditions · ☐ No-go

**Conditions / open defects:**

---

## 13. Owner quick reference (for testers)

1. **Save payout details** — Order Settlements → MoMo or bank → Save.
2. **Check balance** — **Available balance** on same screen.
3. **Withdraw** — Enter amount → **Withdraw via Paystack**.
4. **Track status** — Withdrawal history: Processing → Paid (or Failed → Retry).
5. **Cash orders** — Never appear in settlement balance; staff marks on order details only.
