-- Platform-operator permissions must not sit on tenant Owner / Admin / Super Admin
-- roles (new tenants already omit them via SUPER_ADMIN_EXCLUDED_PERMISSION_CODES).
-- EC2 restores often left these on every Super Admin, which surfaces Merchants,
-- Tenants, Newsletters, Talk to us, Live chat, etc. in the sidebar.
-- Field agent / custom roles that intentionally hold merchants.operate are kept.

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id IS NOT NULL
  AND lower(trim(r.name)) IN ('super admin', 'owner', 'admin', 'administrator')
  AND p.code IN (
      'merchants.view',
      'merchants.operate',
      'tenants.directory.view',
      'newsletter.subscribers.view',
      'newsletter.campaigns.view',
      'newsletter.campaigns.send',
      'contact_requests.view',
      'contact_requests.respond',
      'site_chat.sessions.view',
      'site_chat.sessions.respond'
  );
