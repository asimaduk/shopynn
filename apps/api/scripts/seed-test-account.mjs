#!/usr/bin/env node
/**
 * Idempotent local test account seeder.
 *
 * Creates (or reuses):
 *   email:    test@shopynn.local
 *   password: Test1234!
 *   tenant:   Shopynn Test Store (Free / active)
 *
 * Usage:
 *   npm run seed:test -w @shopynn/api
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const TEST_EMAIL = 'test@shopynn.local';
const TEST_PASSWORD = 'Test1234!';
const TEST_PHONE = '233200000001';
const TEST_TENANT_NAME = 'Shopynn Test Store';

const { default: pool } = await import('../src/config/db.js');
const { createTenantService } = await import('../src/models/tenant.js');
const { SUPER_ADMIN_EXCLUDED_PERMISSION_CODES } = await import('../src/constants/permissionCodes.js');

async function ensurePermissionsSeeded() {
	const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM permissions`);
	if (rows[0].count > 0) return;
	throw new Error(
		'permissions table is empty. Run `npm run db:bootstrap -w @shopynn/api` first.'
	);
}

async function clearPasswordGate(userId, passwordHash) {
	await pool.query(
		`UPDATE users
		 SET password = $1,
		     temporary_password = NULL,
		     password_expires_at = NULL,
		     updated_at = NOW()
		 WHERE id = $2`,
		[passwordHash, userId]
	);
}

async function ensureCompanyProfile(tenantId) {
	await pool.query(
		`UPDATE tenants
		 SET name = COALESCE(NULLIF(name, ''), $2),
		     organization = COALESCE(organization, $2),
		     address = COALESCE(address, 'Accra'),
		     city = COALESCE(city, 'Accra'),
		     country = COALESCE(country, 'Ghana'),
		     phone = COALESCE(phone, $3),
		     email = COALESCE(email, $4),
		     updated_at = NOW()
		 WHERE id = $1`,
		[tenantId, TEST_TENANT_NAME, TEST_PHONE, TEST_EMAIL]
	);
}

async function ensureSampleCatalog(tenantId, userId, warehouseId) {
	const categoryId = 'aaaaaaaa-bbbb-cccc-dddd-000000000001';
	const productId = 'aaaaaaaa-bbbb-cccc-dddd-000000000002';

	await pool.query(
		`INSERT INTO categories (id, name, description, is_active, creator_id, tenant_id, created_at, updated_at)
		 VALUES ($1, 'Beverages', 'Sample category', true, $2, $3, NOW(), NOW())
		 ON CONFLICT (id) DO NOTHING`,
		[categoryId, userId, tenantId]
	);

	await pool.query(
		`INSERT INTO products (
			id, name, slug, sku, unit_price, alt_price, inventory, description,
			reorder_quantity, is_active, creator_id, warehouse_id, tenant_id, categories, tags, created_at, updated_at
		 ) VALUES (
			$1, 'Sample Cola 500ml', 'sample-cola-500ml', 'TEST-COLA-500', 5.00, 4.50, 100,
			'Seeded sample product for POS testing', 10, true, $2, $3, $4, ARRAY[$5]::varchar[], '{}'::varchar[], NOW(), NOW()
		 )
		 ON CONFLICT (id) DO NOTHING`,
		[productId, userId, warehouseId, tenantId, categoryId]
	);
}

async function refreshSuperAdminPermissions(roleId) {
	const excluded = SUPER_ADMIN_EXCLUDED_PERMISSION_CODES;
	const placeholders = excluded.map((_, i) => `$${i + 1}`).join(', ');
	const perms = await pool.query(
		`SELECT id FROM permissions WHERE code NOT IN (${placeholders})`,
		excluded
	);

	for (const row of perms.rows) {
		await pool.query(
			`INSERT INTO role_permissions (id, role_id, permission_id)
			 SELECT $1::varchar, $2::varchar, $3::varchar
			 WHERE NOT EXISTS (
			   SELECT 1 FROM role_permissions WHERE role_id = $2::varchar AND permission_id = $3::varchar
			 )`,
			[uuidv4(), roleId, row.id]
		);
	}
}

async function main() {
	await ensurePermissionsSeeded();

	const existing = await pool.query(
		`SELECT u.id AS user_id, u.tenant_id, u.warehouse_id, ur.role_id
		 FROM users u
		 LEFT JOIN user_roles ur ON ur.user_id = u.id
		 WHERE lower(u.email) = lower($1)
		 LIMIT 1`,
		[TEST_EMAIL]
	);

	let userId;
	let tenantId;
	let warehouseId;
	let roleId;

	const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

	if (existing.rowCount > 0) {
		({ user_id: userId, tenant_id: tenantId, warehouse_id: warehouseId, role_id: roleId } = existing.rows[0]);
		await clearPasswordGate(userId, passwordHash);
		if (roleId) await refreshSuperAdminPermissions(roleId);
		console.log('Updated existing test account password and permissions.');
	} else {
		const created = await createTenantService({
			name: TEST_TENANT_NAME,
			organization: TEST_TENANT_NAME,
			phone: TEST_PHONE,
			email: TEST_EMAIL,
			address: 'Accra',
			city: 'Accra',
			country: 'Ghana',
			subscription_type: 1,
			first_name: 'Test',
			last_name: 'Owner',
			owner_email: TEST_EMAIL,
			owner_phone: TEST_PHONE,
			registration_method: 'manual',
			password: TEST_PASSWORD,
			skip_owner_email_verification: true
		});

		userId = created.user.id;
		tenantId = created.tenant.id;

		const userRow = await pool.query(`SELECT warehouse_id FROM users WHERE id = $1`, [userId]);
		warehouseId = userRow.rows[0]?.warehouse_id;

		const roleRow = await pool.query(`SELECT role_id FROM user_roles WHERE user_id = $1 LIMIT 1`, [userId]);
		roleId = roleRow.rows[0]?.role_id;

		await clearPasswordGate(userId, passwordHash);
		if (roleId) await refreshSuperAdminPermissions(roleId);
		console.log('Created new test tenant + owner.');
	}

	await ensureCompanyProfile(tenantId);
	if (warehouseId) {
		await ensureSampleCatalog(tenantId, userId, warehouseId);
	}

	console.log('');
	console.log('Test login ready:');
	console.log(`  Email:    ${TEST_EMAIL}`);
	console.log(`  Password: ${TEST_PASSWORD}`);
	console.log(`  Tenant:   ${TEST_TENANT_NAME}`);
	console.log(`  User ID:  ${userId}`);
	console.log(`  Tenant ID:${tenantId}`);
}

main()
	.catch((err) => {
		console.error('Seed failed:', err.message || err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await pool.end().catch(() => {});
	});
