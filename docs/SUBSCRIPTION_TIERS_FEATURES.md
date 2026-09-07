# Subscription tiers & features (client-friendly)

This document summarizes what each subscription tier includes in the platform in **module language** (Inventory, Sales, Admin, etc.).

It is based on backend feature-gating (see `apps/api/alt.sql`, `subscription_tiers` and `subscription_tier_features`).

> Key rule: **Orders / customer ordering is a Premium-only module.**

## At a glance

### Basic

- Core single-store operations: **Inventory, Products, Sales, Purchases, Customers, Suppliers**
- Payments + subscription viewing
- Best for: a single branch getting started with day-to-day operations

### Standard

- Everything in Basic, plus:
  - **Multi-store access**
  - **Operational workflows** (Transfers, Adjustments)
  - **Admin tools** (Users, Roles & Permissions, Locations)
  - **Inventory insights** (Reorder + Expiring)
  - **Purchase order workflow**
- Best for: businesses running multiple branches and needing tighter controls

### Premium

- Everything in Standard, plus:
  - **Orders / customer ordering** (Premium-only)
  - **Exports & data export**
  - **Stock counts**
  - **Notifications**
  - **Audit logs**
  - **Advanced order analytics/automation**
- Best for: full platform usage and customer ordering workflows

## Detailed breakdown by module

### Inventory & products

- **Basic**: Inventory view, Products view, Categories view
- **Standard**: Adds Reorder view, Expiring stock view
- **Premium**: Full access

### Sales

- **Basic**: View sales, Create sales
- **Standard**: Adds receipt sharing
- **Premium**: Full access

### Purchases & purchase orders

- **Basic**: View purchases, Create purchases
- **Standard**: Adds purchase order create + receive workflows
- **Premium**: Full access

### Customers & suppliers

- **Basic**: View customers, View suppliers
- **Standard**: Full access
- **Premium**: Full access

### Transfers & adjustments (operational controls)

- **Basic**: Not included
- **Standard**: Transfers (view/details/create) + Adjustments (view/details/create)
- **Premium**: Full access

### Reporting

- **Basic**: Reports not included
- **Standard**: Reports view
- **Premium**: Reports export + full reporting access

### Admin (users, roles, permissions, locations)

- **Basic**: Not included
- **Standard**:
  - Users (view/details/create/update/delete/toggle active)
  - Roles (view/create/update/delete)
  - Permissions view + user role assignments view
  - Locations (view/create/update)
- **Premium**: Full access

### Orders / customer ordering (Premium-only)

- **Basic**: Not included
- **Standard**: Not included
- **Premium**:
  - Orders view + details
  - Create/update/cancel
  - Export
  - Store manage + multi-store manage
  - Analytics + automation tools

### Stock counts

- **Basic**: Not included
- **Standard**: Not included
- **Premium**: Included

### Notifications

- **Basic**: Not included
- **Standard**: Not included
- **Premium**: Included (view/mark read/settings/push)

### Audit logs (compliance)

- **Basic**: Not included
- **Standard**: Not included
- **Premium**: Included

### Payments & subscription

- **Basic**: Payments view/initiate/verify + subscription view
- **Standard**: Full access
- **Premium**: Full access

## Notes (implementation detail)

- Tiers map to feature codes in `subscription_tier_features`.
- Most feature codes align with permission codes (e.g., `inventory.view`, `sales.create`, `orders.view`).
- If tier gating is changed in SQL, existing deployments may require re-seeding/updating `subscription_tier_features` for changes to take effect.

