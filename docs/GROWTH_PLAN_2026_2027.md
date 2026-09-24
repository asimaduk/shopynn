# Shopynn growth & unit economics plan

**Horizon:** Dec 2026 → Dec 2027 (13 months)  
**Pilot:** Oct–Nov 2026 (excluded from revenue targets below)  
**Target:** 30 agents · 300 acquired paying businesses by Dec 2027  
**Currency:** GHS · planning estimates, not audited forecasts

---

## 1. Pricing (current)

### Monthly subscription

| Plan | Marketing name | Price / month |
|------|----------------|---------------|
| Basic | Starter | 149 |
| Standard | Business | 349 |
| Premium | Scale | 649 |

### Optional assisted go-live (one-time)

| Plan | Fee | Includes |
|------|-----|----------|
| Starter | **500** | Setup, training, product import, opening stock |
| Business | **1,300** | Same + multi-branch basics as needed |
| Scale | **2,000** | Same + multi-user / multi-branch handoff |

Self-serve setup = **GHS 0**.  
True extras (sold separately): data migration **3,000** · extra training day **1,000**.

Assisted fee is paid by the shop that wants help — it funds delivery (including any site visit). Go-live travel is **not** a separate Shopynn OpEx line.

**Thermal printer setup alone:** **GHS 150** (included in assisted go-live). On agent onboard, Shopynn sends the shop a **welcome SMS** with official fees so agents cannot inflate charges off-platform.

---

## 2. Agent commission

| Fee | Rate | When |
|-----|------|------|
| Assisted onboarding | **15%** one-time | Only if the shop pays for assisted go-live |
| Subscription | **10% residual** | Every paid month while agent remains **serving agent** |

- Self-serve shops: no 15% onboarding commission; agent still earns **10% residual** if they are the serving agent.
- Residual stops if serving agent is cleared or reassigned.
- Customer fees are paid digitally to Shopynn; agents are paid commission separately.
- SaaS Paystack collection fees (**1.95%**) are **passed to the customer** (not Shopynn OpEx).

**Example (Business + assisted):** go-live 1,300 → commission **195**; subscription 349 → residual **~34.90**/month.

---

## 3. Growth target

| Item | Assumption |
|------|------------|
| Agents | 30 |
| Acquired logos by Dec 2027 | 300 (~10 per agent) |
| Ramp | ~23–24 new paying shops / month for 13 months |
| Plan mix | 40% Starter · 50% Business · 10% Scale |
| Blend ARPU | **~GHS 299**/month |
| Assisted take-rate | **55%** of new logos |
| Monthly churn | **3%** of active base |

**Churn** = paying shops that stop renewing. At 3%/month, acquiring 300 logos leaves about **~251 still paying** at end of Dec 2027 (not 300).

**ARPU** = average revenue per paying shop per month (subscription blend).

---

## 4. Revenue projection (base case)

After agent commissions (“Shopynn keep”):

| Checkpoint | Active shops | MRR | Cumulative keep |
|------------|--------------|-----|-----------------|
| End Dec 2026 | ~24 | ~7k | ~18k |
| End Jun 2027 | ~148 | ~44k | ~244k |
| End Dec 2027 | ~251 | ~75k | **~651k** |

| Metric | Amount (GHS) |
|--------|----------------|
| Cumulative gross billed | ~733k |
| Agent commission pool | ~82k |
| Shopynn keep (after commissions) | **~651k** |
| Exit MRR | ~75k (~900k ARR run-rate) |

Sensitivity (same 300 acquired): keep roughly **577k** (conservative) to **714k** (optimistic / low churn).

---

## 5. Team (to hit the numbers)

**You (founder)** + **3 part-time contractors** (no office):

| Role | Owns | Suggested part-time pay |
|------|------|-------------------------|
| Engineer | Uptime, bugs, light monitoring | ~3,000/mo |
| Merchant success | Shop go-lives, WhatsApp support | ~2,500/mo |
| Head of agents | Recruit/retain agents, field buy-in | ~2,500/mo + small KPI upside |

**Payroll budget:** **GHS 8,000/month** (~104k over 13 months).

Do not conflate merchant success with head of agents: one owns **shops**, the other owns **agents**.

---

## 6. Running costs (core infra + team)

Over Dec 2026–Dec 2027, with SaaS Paystack collect **excluded** (customer-paid):

| Line | ~13-mo total (GHS) | Notes |
|------|-------------------|--------|
| Part-time team | 104,000 | 8,000 × 13 |
| Other (Vercel, domains, tools) | ~9,100 | Ramps ~400 → 1,000/mo |
| Railway | ~8,800 | ~$20 → $70/mo |
| Paystack → merchant wallets | ~6,400 | ~2 withdrawals/shop/mo; mostly MoMo @ GHS 1 |
| Hubtel SMS | ~740 | ~GHS 0.033/SMS |
| **Core run total** | **~129k** | Burn ~8.8k → ~11.1k/mo |

---

## 7. Other costs (lean Ghana assumptions)

| Line | ~13-mo (GHS) | Assumption |
|------|--------------|------------|
| Agent program ops | ~6,650 | 1 kickoff + 2 refreshers + light airtime for head of agents |
| Accounting | ~3,900 | ~300/mo part-time — not a full bookkeeper |
| Legal / MoUs | ~2,000 | Simple agent templates |
| Refunds / chargebacks | ~2,200 | ~0.3% of gross |
| Apple + Google | ~1,920 | $100 + $20 |
| Infra contingency | ~1,250 | 5% of non-team infra |
| Go-live travel | **0** | Covered by assisted onboarding fee |
| Demo devices / paid email | **0** | Agents/shops use own devices; free Gmail |
| **Extras total** | **~18k** | |

| Stack | GHS |
|-------|-----|
| Core run + extras (all OpEx) | **~147k** |
| Keep after commissions | ~651k |
| **Left before founder draw** | **~504k** |

| Founder draw | 13-mo cost | Approx. cash left |
|--------------|------------|-------------------|
| Reinvest (0) | 0 | ~504k |
| Lean 3k/mo | 39k | ~465k |
| Modest 5k/mo | 65k | ~439k |

### Working capital (not OpEx)

Cash parked in Paystack for merchant withdrawals. Size from real volume — often tens of thousands early; higher only if digital GMV through Shopynn is large. Do not treat float as profit.

---

## 8. Bottom line (incl. tax)

If the 300-logo path holds under the assumptions above:

| Step | ~GHS |
|------|------|
| Keep after agent commissions | 651k |
| All OpEx (team + infra + lean extras) | −147k |
| **Left before tax / founder draw** | **~504k** |
| Corporate income tax @ 25% of taxable profit (illustrative) | −126k |
| **Left after CIT** | **~378k** |
| Exit MRR / paying shops | ~75k MRR · ~251 shops |
| Agent commission pool (paid out, before their own tax) | ~82k |

1. Do **not** budget as if the full ~504k is spendable — Ghana CIT is real.  
2. ~**GHS 378k** after illustrative CIT is the order-of-magnitude company surplus before your personal draw.  
3. Largest risk to the P&L is still **missing logo targets**, **higher churn**, or **hiring full-time too early** — not Railway/Hubtel.

---

## 9. Taxes (Ghana / GRA) — essentials

> **Not tax advice.** Confirm with a Ghana tax practitioner / GRA. Rates and rules change; VAT Act 2025 (Act 1151) applies from **1 Jan 2026**.

### 9.1 Corporate income tax (CIT) — the 25%

- **Yes: 25% is fixed on taxable profit** for a standard Ghana company (not on revenue, not on “keep”).
- **Taxable profit** ≈ accounting profit after GRA-allowed deductions (team fees, commissions, hosting, SMS, etc.). It is **not** automatically equal to the ~504k planning residual.
- **Exceptions exist** (sector, location, free zone, approved young-entrepreneur / ICT relief). Without an approved relief, **plan on 25%**.
- **When:** quarterly instalments (typically end **Mar / Jun / Sep / Dec** of the basis year) + annual return and final balance within **4 months** after financial year-end.
- **Illustrative on this plan:** 25% × ~504k ≈ **~GHS 126k** CIT → **~GHS 378k** left after CIT (before personal draw).

### 9.2 VAT + NHIL + GETFund (charge customers)

| Levy | Rate |
|------|------|
| VAT | 15% |
| NHIL | 2.5% |
| GETFund | 2.5% |
| **Effective stack** | **20%** on the same taxable value |

- Subscriptions and assisted go-live are **services**. From **1 Jan 2026**, taxable **service** suppliers generally must **register for VAT within 30 days** of starting (no goods-style turnover threshold).
- **Charge on top** of list prices (or publish VAT-inclusive prices and still account correctly). Same idea as passing Paystack fees to customers — do **not** silently absorb 20% into the 149 / 349 / 649.
- Invoice lines should show NHIL, GETFund, and VAT separately where required.
- **When:** file & pay **monthly** — return for month M due by the **last working day of month M+1**.

### 9.3 Withholding tax (WHT) — deduct when you pay people

| Payment | Typical WHT | What to do |
|---------|-------------|------------|
| Agent / sales / canvassing **commission** | **10%** | Deduct from commission, remit to GRA, issue certificate |
| Part-time **service** fees (eng, merchant success, head of agents) | **7.5%** | Deduct where rules/thresholds apply; remit monthly |
| Later: true **employees** | **PAYE** | Switch off service WHT; run payroll PAYE instead |

On this plan (illustrative cash **timing**, not extra “on top” if you pay net):

- ~10% × ~82k agent commissions ≈ **~8k** remitted  
- ~7.5% × ~104k contractor fees ≈ **~8k** remitted  

If you promise agents a **net** amount, you must **gross-up** (costs more). Prefer quoting **gross** commission and deducting WHT.

**When:** generally by the **15th** of the following month (with the WHT return). PAYE same rhythm if on payroll.

### 9.4 How to register, file, and pay

1. Incorporate / maintain company docs; get **TIN** and register tax types with GRA (**CIT**, **VAT**, **WHT** as withholding agent).  
2. **File** on the GRA Taxpayer Portal ([taxpayersportal.com](https://www.taxpayersportal.com) / current GRA e-services).  
3. **Pay** via Ghana.gov / GRA channels (MoMo, card, bank, USSD where available).  
4. Keep: sales invoices, Paystack settlements, agent commission statements, contractor invoices, WHT certificates — audits follow the paper trail.

### 9.5 Calendar cheat-sheet

| Obligation | Cadence |
|------------|---------|
| VAT / NHIL / GETFund | Monthly (last working day of next month) |
| WHT (+ PAYE if any) | Monthly (by 15th of next month) |
| CIT instalments | Quarterly (Mar / Jun / Sep / Dec) |
| CIT annual return + balance | Within 4 months after year-end |

### 9.6 Taking money out personally

- **Salary** (if on payroll) → PAYE.  
- **Dividend** from after-tax profit → separate dividend rules / WHT may apply.  
- Do not treat company surplus as personal cash until the right channel is used.

### 9.7 Reliefs

Young entrepreneur / ICT holidays or reduced rates **may** apply if you qualify — do **not** bake 0% CIT into the plan until a practitioner confirms eligibility in writing.

### 9.8 One-page money stack (this growth plan)

```
Gross billed                          ~733k
− Agent commissions                   ~82k
= Keep                                ~651k
− OpEx (team + infra + extras)        ~147k
= Left before tax / draw              ~504k
− CIT @ 25% (illustrative)            ~126k
= Left after CIT                      ~378k
VAT 20%                             charged to shops → remitted (not from the 378k)
WHT on agents / contractors         deducted from their payouts → remitted
```

---

## 10. Implementation notes (product)

Already reflected in product/docs direction from this workstream:

- Subscription residual rate **10%** (`SUBSCRIPTION_RESIDUAL_COMMISSION_RATE`).  
- Starter assisted go-live **GHS 500**.  
- Catalog / docs / serving-agent UI aligned to 10% residual.  
- DB migrations when deploying: residual tag + starter assist fee  
  (`20260924_subscription_residual_10.sql`, `20260924_starter_assist_500.sql`).

---

## 11. Related docs

- [AGENT_PARTNER_PROGRAM.md](./AGENT_PARTNER_PROGRAM.md)  
- [MERCHANT_ONBOARDING_PAYMENT_PLAN.md](./MERCHANT_ONBOARDING_PAYMENT_PLAN.md)  
- [PRICING_PACKAGES.md](./PRICING_PACKAGES.md)  

Interactive charts for this model: Cursor canvas `path-to-300-shops.canvas.tsx`.
