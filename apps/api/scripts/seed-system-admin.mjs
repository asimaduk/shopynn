#!/usr/bin/env node
/**
 * Idempotent local platform / system admin seeder.
 *
 * Grants platform marketing permissions (newsletter, contact requests, site chat,
 * tenants directory, merchants) which are excluded from normal Super Admin seeds.
 * Uses an active Premium subscription so plan features unlock those sections.
 *
 *   email:    admin@shopynn.local
 *   password: Admin1234!
 *
 * Usage:
 *   npm run seed:admin -w @shopynn/api
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const ADMIN_EMAIL = 'admin@shopynn.local';
const ADMIN_PASSWORD = 'Admin1234!';
const ADMIN_PHONE = '233200000099';
const ADMIN_TENANT_NAME = 'Shopynn Platform Admin';

const { default: pool } = await import('../src/config/db.js');
const { createTenantService } = await import('../src/models/tenant.js');
const { CUSTOMER_PORTAL_PERMISSION_CODES } = await import('../src/constants/permissionCodes.js');

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

/** Super Admin + platform operator perms (exclude B2C customer-portal codes). */
async function refreshPlatformAdminPermissions(roleId) {
	const excluded = CUSTOMER_PORTAL_PERMISSION_CODES;
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

/** Paid onboarding creates pending; force active Premium for local admin. */
async function ensureActivePremium(tenantId) {
	const sub = await pool.query(
		`SELECT s.id, s.name, s.status
		 FROM tenants t
		 INNER JOIN subscriptions s ON s.id = t.subscription_id
		 WHERE t.id = $1`,
		[tenantId]
	);
	if (sub.rowCount === 0) {
		throw new Error('Tenant has no subscription; cannot activate Premium.');
	}

	const end = new Date();
	end.setFullYear(end.getFullYear() + 1);

	await pool.query(
		`UPDATE subscriptions
		 SET name = 'Premium',
		     status = 'active',
		     start_at = COALESCE(start_at, NOW()),
		     end_at = $2,
		     updated_at = NOW()
		 WHERE id = $1`,
		[sub.rows[0].id, end]
	);
}

async function main() {
	await ensurePermissionsSeeded();

	const existing = await pool.query(
		`SELECT u.id AS user_id, u.tenant_id, ur.role_id
		 FROM users u
		 LEFT JOIN user_roles ur ON ur.user_id = u.id
		 WHERE lower(u.email) = lower($1)
		 LIMIT 1`,
		[ADMIN_EMAIL]
	);

	const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
	let userId;
	let tenantId;
	let roleId;

	if (existing.rowCount > 0) {
		({ user_id: userId, tenant_id: tenantId, role_id: roleId } = existing.rows[0]);
		await clearPasswordGate(userId, passwordHash);
		if (roleId) await refreshPlatformAdminPermissions(roleId);
		await ensureActivePremium(tenantId);
		console.log('Updated existing platform admin password, permissions, and Premium plan.');
	} else {
		const created = await createTenantService({
			name: ADMIN_TENANT_NAME,
			organization: ADMIN_TENANT_NAME,
			phone: ADMIN_PHONE,
			email: ADMIN_EMAIL,
			address: 'Accra',
			city: 'Accra',
			country: 'Ghana',
			subscription_type: 4,
			first_name: 'System',
			last_name: 'Admin',
			owner_email: ADMIN_EMAIL,
			owner_phone: ADMIN_PHONE,
			registration_method: 'manual',
			password: ADMIN_PASSWORD,
			skip_owner_email_verification: true
		});

		userId = created.user.id;
		tenantId = created.tenant.id;

		const roleRow = await pool.query(`SELECT role_id FROM user_roles WHERE user_id = $1 LIMIT 1`, [userId]);
		roleId = roleRow.rows[0]?.role_id;

		await clearPasswordGate(userId, passwordHash);
		if (roleId) await refreshPlatformAdminPermissions(roleId);
		await ensureActivePremium(tenantId);
		console.log('Created platform admin tenant + user.');
	}

	console.log('');
	console.log('Platform admin login ready:');
	console.log(`  Email:    ${ADMIN_EMAIL}`);
	console.log(`  Password: ${ADMIN_PASSWORD}`);
	console.log(`  Tenant:   ${ADMIN_TENANT_NAME} (active Premium)`);
	console.log(`  User ID:  ${userId}`);
	console.log(`  Tenant ID:${tenantId}`);
	console.log('');
	console.log('In the web app, open Marketing → Newsletter subscribers / Talk to us.');
}

main()
	.catch((err) => {
		console.error('Seed failed:', err.message || err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await pool.end().catch(() => {});
	});
