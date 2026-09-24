# Subscription tiers & features (client-friendly)

This document summarizes what each subscription tier includes in the platform in **module language** (Inventory, Sales, Admin, etc.).

It is based on backend feature-gating (see `apps/api/alt.sql`, `subscription_tiers` and `subscription_tier_features`).

Marketing names: **Starter** (Basic), **Business** (Standard), **Scale** (Premium).

> Key rule: **Orders / customer ordering is Scale/Premium-only.**

## At a glance

### Starter (Basic)

- Core single-store operations: **Inventory, Products, Sales, Purchases, Customers, Suppliers**
- Receipt sharing, customer/supplier create & edit
- Payments + subscription viewing
- **Reports view + CSV/Excel export** (incl. accountant pack)
- Best for: a single branch getting started with day-to-day operations

### Business (Standard)

- Everything in Starter, plus:
  - **Multi-store access**
  - **Operational workflows** (Transfers, Adjustments, **Stock counts**)
  - **Admin tools** (Users, Roles & Permissions, Locations)
  - **Inventory insights** (Reorder + Expiring)
  - **Purchase order workflow**
  - **Reports (view + export)**
  - **Notifications** (inbox, preferences, push)
- Best for: businesses running staff and/or multiple branches

### Scale (Premium)

- Everything in Business, plus:
  - **Orders / customer ordering** (Scale-only)
  - **Full data export / backup** (`data_export`)
  - **Audit logs**
  - **Advanced order analytics/automation**
- Best for: full platform usage and customer ordering workflows

## Detailed breakdown by module

### Inventory & products

- **Starter**: Inventory view, Products view, Categories view
- **Business**: Adds Reorder view, Expiring stock view, **Stock counts**
- **Scale**: Full access

### Sales

- **Starter**: View sales, Create sales, **Share receipt**
- **Business**: Full sales ops access
- **Scale**: Full access

### Purchases & purchase orders

- **Starter**: View purchases, Create purchases
- **Business**: Adds purchase order create + receive workflows
- **Scale**: Full access

### Customers & suppliers

- **Starter**: View, **create, and update** customers & suppliers
- **Business**: Full access
- **Scale**: Full access

### Transfers & adjustments (operational controls)

- **Starter**: Not included
- **Business**: Transfers (view/details/create) + Adjustments (view/details/create)
- **Scale**: Full access

### Reporting

- **Starter**: Reports not included
- **Business**: Reports view
- **Scale**: Reports export + full reporting access

### Admin (users, roles, permissions, locations)

- **Starter**: Basic user management (plan limits); custom roles not included
- **Business**:
  - Users (view/details/create/update/delete/toggle active)
  - Roles (view/create/update/delete)
  - Permissions view + user role assignments view
  - Locations (view/create/update)
- **Scale**: Full access

### Notifications

- **Starter**: Not included
- **Business**: Inbox, mark read, settings, push
- **Scale**: Full access

### Orders / customer ordering (Scale-only)

- **Starter**: Not included
- **Business**: Not included
- **Scale**:
  - Orders view + details
  - Create/update/cancel
  - Export
  - Store manage + multi-store manage
  - Analytics + automation tools

### Audit logs (compliance)

- **Starter**: Not included
- **Business**: Not included
- **Scale**: Included

### Payments & subscription

- **Starter**: Payments initiate/verify + subscription view
- **Business**: Full access as gated
- **Scale**: Full access (incl. order payments view where applicable)

## Notes (implementation detail)

- Tiers map to feature codes in `subscription_tier_features`.
- Most feature codes align with permission codes (e.g., `inventory.view`, `sales.create`, `orders.view`).
- If tier gating is changed in SQL, existing deployments may require re-seeding/updating `subscription_tier_features` for changes to take effect (see migration `20260923_tier_features_business_ops_reshuffle.sql`).
