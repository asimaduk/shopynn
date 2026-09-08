#!/usr/bin/env node
/**
 * Idempotent local merchant-manager + field-agent seeders.
 *
 * Lives on the Shopynn Platform Admin tenant (same as seed:admin).
 *
 *   Merchant manager (can add/promote agents):
 *     email:    manager@shopynn.local
 *     password: Manager1234!
 *
 *   Field agent / merchant partner (onboard shops, earn commissions):
 *     email:    agent@shopynn.local
 *     password: Agent1234!
 *
 * Prerequisites:
 *   npm run seed:admin -w @shopynn/api   (creates platform tenant + Premium)
 *
 * Usage:
 *   npm run seed:merchants -w @shopynn/api
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const PLATFORM_ADMIN_EMAIL = 'admin@shopynn.local';

const MANAGER = {
	email: 'manager@shopynn.local',
	password: 'Manager1234!',
	phone: '233200000088',
	first_name: 'Merchant',
	last_name: 'Manager',
	roleName: 'Merchant Manager',
	roleDescription: 'Can list, promote, and manage field agents only (merchants.view).',
	/** Keep this list tight — no dashboard / users / roles menus. */
	permissionCodes: [
		'profile.view',
		'profile.update',
		'auth.reset_password',
		'merchants.view',
	],
};

const AGENT = {
	email: 'agent@shopynn.local',
	password: 'Agent1234!',
	phone: '233200000077',
	first_name: 'Field',
	last_name: 'Agent',
	default_commission_percent: 5,
};

const { default: pool } = await import('../src/config/db.js');
const { ensureFieldAgentRoleForTenant, createMerchantRecordService, getMerchantByUserId } =
	await import('../src/models/merchant.js');

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

async function resolvePlatformTenant() {
	const r = await pool.query(
		`SELECT u.id AS user_id, u.tenant_id, t.name AS tenant_name
		 FROM users u
		 INNER JOIN tenants t ON t.id = u.tenant_id
		 WHERE lower(u.email) = lower($1)
		 LIMIT 1`,
		[PLATFORM_ADMIN_EMAIL]
	);
	if (r.rowCount === 0) {
		throw new Error(
			`Platform admin ${PLATFORM_ADMIN_EMAIL} not found. Run \`npm run seed:admin -w @shopynn/api\` first.`
		);
	}
	return r.rows[0];
}

async function ensureRoleWithPermissions(tenantId, name, description, permissionCodes) {
	let role = await pool.query(
		`SELECT id FROM roles WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
		[tenantId, name]
	);
	let roleId;
	if (role.rowCount > 0) {
		roleId = role.rows[0].id;
	} else {
		roleId = uuidv4();
		await pool.query(
			`INSERT INTO roles (id, name, description, tenant_id, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[roleId, name, description, tenantId]
		);
	}

	const perms = await pool.query(
		`SELECT id, code FROM permissions WHERE code = ANY($1::text[])`,
		[permissionCodes]
	);
	const found = new Set(perms.rows.map((p) => p.code));
	const missing = permissionCodes.filter((c) => !found.has(c));
	if (missing.length) {
		throw new Error(`Missing permissions in DB: ${missing.join(', ')}. Re-run db:bootstrap.`);
	}

	// Exact sync: drop anything not in the allowlist so menus stay merchant-only.
	await pool.query(
		`DELETE FROM role_permissions rp
		 USING permissions p
		 WHERE rp.role_id = $1
		   AND rp.permission_id = p.id
		   AND NOT (p.code = ANY($2::text[]))`,
		[roleId, permissionCodes]
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

	return roleId;
}

async function ensureUser({ email, password, phone, first_name, last_name, tenantId, roleId }) {
	const passwordHash = await bcrypt.hash(password, 10);
	const existing = await pool.query(
		`SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
		[email]
	);

	let userId;
	if (existing.rowCount > 0) {
		userId = existing.rows[0].id;
		await pool.query(
			`UPDATE users
			 SET first_name = $2, last_name = $3, phone = $4, tenant_id = $5, is_active = true, updated_at = NOW()
			 WHERE id = $1`,
			[userId, first_name, last_name, phone, tenantId]
		);
		await clearPasswordGate(userId, passwordHash);
	} else {
		userId = uuidv4();
		await pool.query(
			`INSERT INTO users (
				id, first_name, last_name, email, tenant_id, phone, password,
				temporary_password, password_expires_at, created_at, is_active, registration_method
			 ) VALUES (
				$1, $2, $3, $4, $5, $6, $7,
				NULL, NULL, NOW(), true, 'manual'
			 )`,
			[userId, first_name, last_name, email, tenantId, phone, passwordHash]
		);
	}

	await pool.query(
		`INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
		 SELECT $1::varchar, $2::varchar, $3::varchar, NULL, NOW()
		 WHERE NOT EXISTS (
		   SELECT 1 FROM user_roles WHERE user_id = $2::varchar AND role_id = $3::varchar
		 )`,
		[uuidv4(), userId, roleId]
	);

	return userId;
}

async function main() {
	await ensurePermissionsSeeded();
	const platform = await resolvePlatformTenant();
	const tenantId = platform.tenant_id;

	const managerRoleId = await ensureRoleWithPermissions(
		tenantId,
		MANAGER.roleName,
		MANAGER.roleDescription,
		MANAGER.permissionCodes
	);
	const managerUserId = await ensureUser({
		...MANAGER,
		tenantId,
		roleId: managerRoleId,
	});

	const fieldAgentRole = await ensureFieldAgentRoleForTenant(tenantId);
	const agentUserId = await ensureUser({
		email: AGENT.email,
		password: AGENT.password,
		phone: AGENT.phone,
		first_name: AGENT.first_name,
		last_name: AGENT.last_name,
		tenantId,
		roleId: fieldAgentRole.id,
	});

	let merchant = await getMerchantByUserId(agentUserId);
	if (!merchant) {
		await createMerchantRecordService({
			user_id: agentUserId,
			default_commission_percent: AGENT.default_commission_percent,
		});
		merchant = await getMerchantByUserId(agentUserId);
	}

	console.log('');
	console.log('Merchant accounts ready on tenant:', platform.tenant_name);
	console.log('');
	console.log('1) Merchant manager (add / promote agents):');
	console.log(`   Email:    ${MANAGER.email}`);
	console.log(`   Password: ${MANAGER.password}`);
	console.log(`   User ID:  ${managerUserId}`);
	console.log('');
	console.log('2) Field agent / merchant partner:');
	console.log(`   Email:    ${AGENT.email}`);
	console.log(`   Password: ${AGENT.password}`);
	console.log(`   User ID:  ${agentUserId}`);
	console.log(`   Merchant: ${merchant?.id || '—'}`);
	console.log('');
	console.log('Web: http://127.0.0.1:3001/sign-in');
	console.log('Manager → Merchants → Add merchant');
	console.log('Agent → Merchants / Clients → Onboard business');
}

main()
	.catch((err) => {
		console.error('Seed failed:', err.message || err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await pool.end().catch(() => {});
	});
