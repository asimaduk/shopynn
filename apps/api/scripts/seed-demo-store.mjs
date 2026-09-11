#!/usr/bin/env node
/**
 * Dedicated Shopynn Demo Store for field agents / merchants to demo to shop owners.
 *
 * Creates (or reuses):
 *   Tenant:   Shopynn Demo Store (Premium)
 *   Owner:    demo@shopynn.app / DemoStore2026!
 *   Agent:    demo-agent@shopynn.app / DemoAgent2026!
 *
 * Then loads the Ghana retail catalog + ~6 months of activity.
 *
 * Usage:
 *   npm run seed:demo-store -w @shopynn/api
 *   DATABASE_URL='postgresql://…' npm run seed:demo-store -w @shopynn/api
 *   npm run seed:demo-store -w @shopynn/api -- --no-activity
 */
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { runDemoCatalogSeed } from './seed-demo-catalog.mjs';

const DEMO_TENANT_NAME = 'Shopynn Demo Store';
const OWNER = {
	email: 'demo@shopynn.app',
	password: 'DemoStore2026!',
	phone: '233200000100',
	first_name: 'Demo',
	last_name: 'Owner',
};
const AGENT = {
	email: 'demo-agent@shopynn.app',
	password: 'DemoAgent2026!',
	phone: '233200000101',
	first_name: 'Field',
	last_name: 'Agent',
};

const args = process.argv.slice(2);
const noActivity = args.includes('--no-activity');
const skipCatalog = args.includes('--skip-catalog');

const { default: pool } = await import('../src/config/db.js');
const { createTenantService } = await import('../src/models/tenant.js');
const { SUPER_ADMIN_EXCLUDED_PERMISSION_CODES } = await import('../src/constants/permissionCodes.js');

async function ensurePermissionsSeeded() {
	const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM permissions`);
	if (rows[0].count > 0) return;
	throw new Error('permissions table is empty. Run `npm run db:bootstrap -w @shopynn/api` first.');
}

async function clearPasswordGate(userId, passwordHash) {
	await pool.query(
		`UPDATE users
		 SET password = $1,
		     temporary_password = NULL,
		     password_expires_at = NULL,
		     is_active = true,
		     updated_at = NOW()
		 WHERE id = $2`,
		[passwordHash, userId]
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

async function ensurePremium(tenantId) {
	// Activate whatever plan is linked on the tenant (onboarding may leave it pending).
	await pool.query(
		`UPDATE subscriptions s
		 SET status = 'active',
		     tenant_id = COALESCE(s.tenant_id, $1),
		     name = 'Premium',
		     amount = COALESCE(NULLIF(s.amount, 0), 799),
		     end_at = GREATEST(COALESCE(s.end_at, NOW()), NOW() + interval '365 days'),
		     updated_at = NOW()
		 FROM tenants t
		 WHERE t.id = $1 AND s.id = t.subscription_id`,
		[tenantId]
	);

	// Ensure Premium tier includes online-order feature codes (needed when
	// migration 20260911 was skipped because schema_migrations already recorded it).
	const storeOrderFeatures = [
		'orders.view',
		'orders.details.view',
		'orders.create',
		'orders.update',
		'orders.cancel',
		'orders.status.update',
		'orders.process',
		'orders.store.view',
		'orders.store.manage',
		'orders.delivery.view',
		'orders.delivery.manage',
		'orders.fulfillment.assign',
		'orders.export',
		'orders.analytics.view',
		'orders.automation.manage',
		'orders.multi_store.manage',
	];
	for (const code of storeOrderFeatures) {
		await pool.query(
			`INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
			 SELECT $1::varchar, t.id, $2::varchar, NOW()
			 FROM subscription_tiers t
			 WHERE lower(t.code) = 'premium'
			   AND NOT EXISTS (
			     SELECT 1 FROM subscription_tier_features stf
			     WHERE stf.tier_id = t.id AND lower(stf.feature_code) = lower($2)
			   )
			 LIMIT 1`,
			[uuidv4(), code]
		);
	}
}

async function ensureCompanyProfile(tenantId) {
	await pool.query(
		`UPDATE tenants
		 SET name = $2,
		     organization = $2,
		     address = COALESCE(address, 'Accra'),
		     city = COALESCE(city, 'Accra'),
		     country = COALESCE(country, 'Ghana'),
		     phone = COALESCE(phone, $3),
		     email = COALESCE(email, $4),
		     notes = COALESCE(notes, 'Official Shopynn field-agent demo store. Do not use for real sales.'),
		     updated_at = NOW()
		 WHERE id = $1`,
		[tenantId, DEMO_TENANT_NAME, OWNER.phone, OWNER.email]
	);
}

async function ensureOwner() {
	const existing = await pool.query(
		`SELECT u.id AS user_id, u.tenant_id, u.warehouse_id, ur.role_id
		 FROM users u
		 LEFT JOIN user_roles ur ON ur.user_id = u.id
		 WHERE lower(u.email) = lower($1)
		 LIMIT 1`,
		[OWNER.email]
	);

	const passwordHash = await bcrypt.hash(OWNER.password, 10);

	if (existing.rowCount > 0) {
		const row = existing.rows[0];
		await clearPasswordGate(row.user_id, passwordHash);
		if (row.role_id) await refreshSuperAdminPermissions(row.role_id);
		await ensureCompanyProfile(row.tenant_id);
		await ensurePremium(row.tenant_id);
		const wh =
			row.warehouse_id ||
			(
				await pool.query(
					`SELECT id FROM warehouses WHERE tenant_id = $1 ORDER BY created_at ASC NULLS LAST LIMIT 1`,
					[row.tenant_id]
				)
			).rows[0]?.id;
		return { userId: row.user_id, tenantId: row.tenant_id, warehouseId: wh, roleId: row.role_id };
	}

	const created = await createTenantService({
		name: DEMO_TENANT_NAME,
		organization: DEMO_TENANT_NAME,
		phone: OWNER.phone,
		email: OWNER.email,
		address: 'Accra',
		city: 'Accra',
		country: 'Ghana',
		subscription_type: 4,
		first_name: OWNER.first_name,
		last_name: OWNER.last_name,
		owner_email: OWNER.email,
		owner_phone: OWNER.phone,
		registration_method: 'manual',
		password: OWNER.password,
		skip_owner_email_verification: true,
	});

	const userId = created.user.id;
	const tenantId = created.tenant.id;
	const userRow = await pool.query(`SELECT warehouse_id FROM users WHERE id = $1`, [userId]);
	const warehouseId = userRow.rows[0]?.warehouse_id;
	const roleRow = await pool.query(`SELECT role_id FROM user_roles WHERE user_id = $1 LIMIT 1`, [userId]);
	const roleId = roleRow.rows[0]?.role_id;

	await clearPasswordGate(userId, passwordHash);
	if (roleId) await refreshSuperAdminPermissions(roleId);
	await ensureCompanyProfile(tenantId);
	await ensurePremium(tenantId);

	return { userId, tenantId, warehouseId, roleId };
}

async function ensureAgentStaff({ tenantId, warehouseId, ownerRoleId, ownerUserId }) {
	const existing = await pool.query(
		`SELECT id, tenant_id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
		[AGENT.email]
	);
	const passwordHash = await bcrypt.hash(AGENT.password, 10);

	if (existing.rowCount > 0) {
		const userId = existing.rows[0].id;
		if (existing.rows[0].tenant_id !== tenantId) {
			throw new Error(
				`${AGENT.email} already exists on a different tenant. Remove or rename that user first.`
			);
		}
		await clearPasswordGate(userId, passwordHash);
		await pool.query(
			`UPDATE users SET warehouse_id = COALESCE(warehouse_id, $1), updated_at = NOW() WHERE id = $2`,
			[warehouseId, userId]
		);
		if (ownerRoleId) {
			await pool.query(
				`INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
				 SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar, NOW()
				 WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = $2 AND role_id = $3)`,
				[uuidv4(), userId, ownerRoleId, ownerUserId]
			);
		}
		return userId;
	}

	const userId = uuidv4();
	await pool.query(
		`INSERT INTO users (
			id, first_name, last_name, email, phone, password, tenant_id, warehouse_id,
			is_active, registration_method, created_at, updated_at
		 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 'manual', NOW(), NOW())`,
		[
			userId,
			AGENT.first_name,
			AGENT.last_name,
			AGENT.email,
			AGENT.phone,
			passwordHash,
			tenantId,
			warehouseId,
		]
	);

	if (ownerRoleId) {
		await pool.query(
			`INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
			 VALUES ($1, $2, $3, $4, NOW())`,
			[uuidv4(), userId, ownerRoleId, ownerUserId]
		);
	}

	return userId;
}

async function main() {
	await ensurePermissionsSeeded();

	console.log('Shopynn Demo Store setup');
	console.log(`  Tenant: ${DEMO_TENANT_NAME}`);

	const owner = await ensureOwner();
	console.log(`  Owner:  ${OWNER.email} (${owner.userId})`);

	const agentId = await ensureAgentStaff({
		tenantId: owner.tenantId,
		warehouseId: owner.warehouseId,
		ownerRoleId: owner.roleId,
		ownerUserId: owner.userId,
	});
	console.log(`  Agent:  ${AGENT.email} (${agentId})`);

	if (!skipCatalog) {
		console.log('');
		await runDemoCatalogSeed({
			email: OWNER.email,
			wipe: true,
			noActivity,
			pool,
		});
	} else {
		await pool.end().catch(() => {});
	}

	console.log('');
	console.log('Field agents can sign in with:');
	console.log(`  Email:    ${AGENT.email}`);
	console.log(`  Password: ${AGENT.password}`);
	console.log('Owner (admin) login:');
	console.log(`  Email:    ${OWNER.email}`);
	console.log(`  Password: ${OWNER.password}`);
	console.log(`  Tenant:   ${DEMO_TENANT_NAME}`);
}

main().catch(async (err) => {
	console.error('Demo store seed failed:', err.message || err);
	process.exitCode = 1;
	await pool.end().catch(() => {});
});
