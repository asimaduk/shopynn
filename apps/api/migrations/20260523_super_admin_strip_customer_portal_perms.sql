-- Remove B2C customer-portal permissions from existing tenant Super Admin roles.
-- These belong on the separate "Customer" role (storefront shoppers), not the owner Super Admin.
-- New tenants are already correct via SUPER_ADMIN_EXCLUDED_PERMISSION_CODES in createUserService.
--
-- Run: psql -U postgres -d <your_db> -f migrations/20260523_super_admin_strip_customer_portal_perms.sql

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id IS NOT NULL
  AND lower(trim(r.name)) = 'super admin'
  AND p.code IN (
    'orders.view',
    'orders.create',
    'orders.details.view',
    'orders.cancel',
    'notifications.view'
  );
