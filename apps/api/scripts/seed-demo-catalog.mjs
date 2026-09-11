#!/usr/bin/env node
/**
 * Wipe + reseed a tenant catalog (and optional 6‑month sales/purchases/expenses).
 *
 * Usage:
 *   npm run seed:demo-catalog -w @shopynn/api -- --wipe
 *   npm run seed:demo-catalog -w @shopynn/api -- --wipe --email=you@example.com
 *   npm run seed:demo-catalog -w @shopynn/api -- --wipe --no-activity
 *   npm run seed:demo-catalog -w @shopynn/api -- --activity-only --email=you@example.com
 *
 * Flags:
 *   --wipe            Wipe + reseed catalog (required unless --activity-only)
 *   --activity-only   Keep catalog; wipe txs/partners and seed 6 months of activity
 *   --no-activity     Skip sales/purchases/expenses (catalog only)
 *   --email=…         Account email (default: test@shopynn.local)
 *   --keep-tx         With --wipe: keep sales/purchases (not recommended for demos)
 */
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from './demo-catalog-data.mjs';
import { DEMO_CUSTOMERS, DEMO_SUPPLIERS, DEMO_EXPENSE_TEMPLATES } from './demo-activity-data.mjs';

const isCli =
	Boolean(process.argv[1]) &&
	path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

function parseCliOptions() {
	const args = process.argv.slice(2);
	const emailArg = args.find((a) => a.startsWith('--email='));
	return {
		wipe: args.includes('--wipe'),
		keepTx: args.includes('--keep-tx'),
		activityOnly: args.includes('--activity-only'),
		noActivity: args.includes('--no-activity'),
		email: (emailArg ? emailArg.slice('--email='.length) : 'test@shopynn.local').trim().toLowerCase(),
	};
}

function slugify(name) {
	return String(name)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 80);
}

/** Deterministic PRNG for repeatable demo data. */
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick(rand, arr) {
	return arr[Math.floor(rand() * arr.length) % arr.length];
}

function randInt(rand, min, max) {
	return Math.floor(rand() * (max - min + 1)) + min;
}

function money(n) {
	return Math.round(Number(n) * 100) / 100;
}

async function resolveAccount(db, email) {
	const { rows } = await db.query(
		`SELECT u.id AS user_id, u.tenant_id, u.warehouse_id, t.name AS tenant_name, u.email
		 FROM users u
		 JOIN tenants t ON t.id = u.tenant_id
		 WHERE lower(u.email) = lower($1)
		 LIMIT 1`,
		[email]
	);
	if (!rows.length) {
		throw new Error(`No user found for email: ${email}`);
	}
	const row = rows[0];
	if (!row.warehouse_id) {
		const wh = await db.query(
			`SELECT id FROM warehouses WHERE tenant_id = $1 ORDER BY created_at ASC NULLS LAST LIMIT 1`,
			[row.tenant_id]
		);
		row.warehouse_id = wh.rows[0]?.id;
	}
	if (!row.warehouse_id) {
		throw new Error(`User ${email} has no warehouse on tenant ${row.tenant_name}`);
	}
	return row;
}

async function wipeTransactions(client, tenantId) {
	await client.query(
		`DELETE FROM adjustmentdetails WHERE adjustment_id IN (SELECT id FROM adjustments WHERE tenant_id = $1)`,
		[tenantId]
	);
	await client.query(`DELETE FROM adjustments WHERE tenant_id = $1`, [tenantId]);
	await client.query(`DELETE FROM saledetails WHERE sale_id IN (SELECT id FROM sales WHERE tenant_id = $1)`, [
		tenantId,
	]);
	await client.query(`DELETE FROM sales WHERE tenant_id = $1`, [tenantId]);
	await client.query(
		`DELETE FROM purchasedetails WHERE purchase_id IN (SELECT id FROM purchases WHERE tenant_id = $1)`,
		[tenantId]
	);
	await client.query(`DELETE FROM purchases WHERE tenant_id = $1`, [tenantId]);
	await client.query(`DELETE FROM return_details WHERE return_id IN (SELECT id FROM returns WHERE tenant_id = $1)`, [
		tenantId,
	]);
	await client.query(`DELETE FROM returns WHERE tenant_id = $1`, [tenantId]);
	await client.query(
		`DELETE FROM transferdetails WHERE transfer_id IN (SELECT id FROM transfers WHERE tenant_id = $1)`,
		[tenantId]
	);
	await client.query(`DELETE FROM transfers WHERE tenant_id = $1`, [tenantId]);
	await client.query(
		`DELETE FROM stock_count_details WHERE stock_count_id IN (SELECT id FROM stock_counts WHERE tenant_id = $1)`,
		[tenantId]
	);
	await client.query(`DELETE FROM stock_counts WHERE tenant_id = $1`, [tenantId]);
	await client.query(`DELETE FROM expenses WHERE tenant_id = $1`, [tenantId]);
}

async function wipePartners(client, tenantId) {
	// Safe after sales/purchases wiped (customer_id / supplier_id FKs)
	await client.query(`DELETE FROM customers WHERE tenant_id = $1`, [tenantId]);
	await client.query(`DELETE FROM suppliers WHERE tenant_id = $1`, [tenantId]);
}

async function wipeTenantCatalog(client, tenantId, { keepTransactions }) {
	const productIds = await client.query(`SELECT id FROM products WHERE tenant_id = $1`, [tenantId]);
	const ids = productIds.rows.map((r) => r.id);
	console.log(`  Products to remove: ${ids.length}`);

	if (ids.length) {
		await client.query(`DELETE FROM adjustmentdetails WHERE product_id = ANY($1::varchar[])`, [ids]);
		await client.query(`DELETE FROM saledetails WHERE product_id = ANY($1::varchar[])`, [ids]);
		await client.query(`DELETE FROM purchasedetails WHERE product_id = ANY($1::varchar[])`, [ids]);
		await client.query(`DELETE FROM return_details WHERE product_id = ANY($1::varchar[])`, [ids]);
		await client.query(`DELETE FROM transferdetails WHERE product_id = ANY($1::varchar[])`, [ids]);
		await client.query(`DELETE FROM stock_count_details WHERE product_id = ANY($1::varchar[])`, [ids]);
		await client.query(`DELETE FROM order_items WHERE product_id = ANY($1::varchar[])`, [ids]);
		await client.query(`DELETE FROM inventories WHERE product_id = ANY($1::varchar[])`, [ids]);
		await client.query(`DELETE FROM products WHERE id = ANY($1::varchar[])`, [ids]);
	}

	if (!keepTransactions) {
		await wipeTransactions(client, tenantId);
		await wipePartners(client, tenantId);
		await client.query(`DELETE FROM inventories WHERE tenant_id = $1`, [tenantId]);
	}

	await client.query(`DELETE FROM categories WHERE tenant_id = $1`, [tenantId]);
}

async function seedCatalog(client, { tenantId, userId, warehouseId }) {
	const categoryIds = {};
	const skuPrefix = `D${String(tenantId).replace(/-/g, '').slice(0, 8)}`;

	for (const cat of DEMO_CATEGORIES) {
		const id = uuidv4();
		categoryIds[cat.key] = id;
		await client.query(
			`INSERT INTO categories (id, name, description, is_active, creator_id, tenant_id, created_at, updated_at)
			 VALUES ($1, $2, $3, true, $4, $5, NOW(), NOW())`,
			[id, cat.name, cat.description, userId, tenantId]
		);
	}

	let created = 0;
	for (const prod of DEMO_PRODUCTS) {
		const categoryId = categoryIds[prod.category];
		if (!categoryId) throw new Error(`Unknown category key: ${prod.category}`);
		const id = uuidv4();
		const sku = `${skuPrefix}-${prod.sku}`;
		const slug = `${slugify(prod.name)}-${sku.toLowerCase()}`;
		const altPrice = Math.round(prod.unit_price * 0.95 * 100) / 100;

		await client.query(
			`INSERT INTO products (
				id, name, slug, sku, unit_price, alt_price, actual_cost, inventory, unit, bar_code,
				description, reorder_quantity, is_active, creator_id, warehouse_id, tenant_id,
				categories, tags, product_type, measurement_unit, allows_fractional_qty,
				min_order_qty, qty_step, installment_enabled, created_at, updated_at
			 ) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, 'units', $9,
				$10, $11, true, $12, $13, $14,
				ARRAY[$15]::varchar[], '{}'::varchar[], 'standard', 'units', false,
				1, 1, false, NOW(), NOW()
			 )`,
			[
				id,
				prod.name,
				slug,
				sku,
				prod.unit_price,
				altPrice,
				prod.actual_cost,
				prod.stock,
				prod.barcode || null,
				prod.description || null,
				prod.reorder,
				userId,
				warehouseId,
				tenantId,
				categoryId,
			]
		);

		await client.query(
			`INSERT INTO inventories (
				id, quantity_available, minimum_stock_level, product_id, warehouse_id,
				creator_id, tenant_id, created_at, updated_at
			 ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
			[uuidv4(), prod.stock, prod.reorder, id, warehouseId, userId, tenantId]
		);
		created += 1;
	}

	return created;
}

async function seedPartners(client, { tenantId, userId }) {
	const customers = [];
	for (const c of DEMO_CUSTOMERS) {
		const id = uuidv4();
		await client.query(
			`INSERT INTO customers (id, name, email, address, phone, customer_group, tenant_id, creator_id, created_at, is_active, notes)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), true, $9)`,
			[id, c.name, c.email, c.address, c.phone, c.customer_group, tenantId, userId, 'Demo seed customer']
		);
		customers.push(id);
	}

	const suppliers = [];
	for (const s of DEMO_SUPPLIERS) {
		const id = uuidv4();
		await client.query(
			`INSERT INTO suppliers (id, name, address, manager, tenant_id, phone, creator_id, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
			[id, s.name, s.address, s.manager, tenantId, s.phone, userId]
		);
		suppliers.push(id);
	}

	return { customers, suppliers };
}

async function seedSixMonthActivity(client, { tenantId, userId, warehouseId, customerIds, supplierIds }) {
	const productsResult = await client.query(
		`SELECT id, unit_price, actual_cost, name
		 FROM products
		 WHERE tenant_id = $1 AND is_active IS DISTINCT FROM false
		 ORDER BY name ASC`,
		[tenantId]
	);
	const products = productsResult.rows;
	if (!products.length) {
		throw new Error('No products found — seed catalog before activity.');
	}

	const rand = mulberry32(20260911);
	const end = new Date();
	end.setHours(18, 0, 0, 0);
	const start = new Date(end);
	start.setMonth(start.getMonth() - 6);
	start.setHours(9, 0, 0, 0);

	let salesCount = 0;
	let purchasesCount = 0;
	let expensesCount = 0;
	let saleSeq = 1;
	let purchaseSeq = 1;

	const day = new Date(start);
	while (day <= end) {
		const dow = day.getDay(); // 0 Sun
		const isWeekend = dow === 0 || dow === 6;
		const daySeed = day.toISOString().slice(0, 10);

		// Purchases: ~2–4 per week
		if (!isWeekend && rand() < 0.35) {
			const supplierId = pick(rand, supplierIds);
			const lineCount = randInt(rand, 3, 8);
			const lines = [];
			for (let i = 0; i < lineCount; i++) {
				const p = pick(rand, products);
				const qty = randInt(rand, 6, 36);
				const unit = money(Number(p.actual_cost || p.unit_price) * (0.95 + rand() * 0.1));
				lines.push({ product_id: p.id, quantity: qty, unit_price: unit });
			}
			const number_of_items = lines.reduce((s, l) => s + l.quantity, 0);
			const total_amount = money(lines.reduce((s, l) => s + l.quantity * l.unit_price, 0));
			const purchaseId = uuidv4();
			const createdAt = new Date(day);
			createdAt.setHours(10 + randInt(rand, 0, 3), randInt(rand, 0, 59), randInt(rand, 0, 59), 0);
			const invoice = `PO-DEMO-${daySeed.replace(/-/g, '')}-${String(purchaseSeq++).padStart(4, '0')}`;

			await client.query(
				`INSERT INTO purchases (
					id, number_of_items, total_amount, discount_amount, tenant_id, invoice_number,
					current_status, receiver_id, warehouse_id, supplier_id, notes, created_at
				 ) VALUES ($1, $2, $3, 0, $4, $5, 1, $6, $7, $8, $9, $10)`,
				[
					purchaseId,
					number_of_items,
					total_amount,
					tenantId,
					invoice,
					userId,
					warehouseId,
					supplierId,
					'Demo seed purchase',
					createdAt,
				]
			);

			for (const line of lines) {
				await client.query(
					`INSERT INTO purchasedetails (
						id, purchase_id, product_id, unit_price, quantity, supplier_id,
						warehouse_id, tenant_id, created_at, creator_id
					 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
					[
						uuidv4(),
						purchaseId,
						line.product_id,
						line.unit_price,
						line.quantity,
						supplierId,
						warehouseId,
						tenantId,
						createdAt,
						userId,
					]
				);
			}
			purchasesCount += 1;
		}

		// Sales: more on weekdays, some on weekends
		const salesToday = isWeekend ? randInt(rand, 0, 2) : randInt(rand, 1, 4);
		for (let s = 0; s < salesToday; s++) {
			const customerId = pick(rand, customerIds);
			const lineCount = randInt(rand, 1, 5);
			const lines = [];
			for (let i = 0; i < lineCount; i++) {
				const p = pick(rand, products);
				const qty = randInt(rand, 1, 6);
				const unit = money(Number(p.unit_price) * (0.98 + rand() * 0.04));
				const cost = money(Number(p.actual_cost || p.unit_price * 0.75));
				lines.push({ product_id: p.id, quantity: qty, unit_price: unit, unit_cost: cost });
			}
			const number_of_items = lines.reduce((sum, l) => sum + l.quantity, 0);
			const total_amount = money(lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0));
			const saleId = uuidv4();
			const createdAt = new Date(day);
			createdAt.setHours(9 + randInt(rand, 0, 9), randInt(rand, 0, 59), randInt(rand, 0, 59), 0);
			const invoice = `INV-DEMO-${daySeed.replace(/-/g, '')}-${String(saleSeq++).padStart(4, '0')}`;
			const paymentType = pick(rand, [1, 1, 2, 2, 3]); // cash / momo / card weighted

			await client.query(
				`INSERT INTO sales (
					id, number_of_items, total_amount, discount_amount, tenant_id, invoice_number,
					current_status, customer_id, warehouse_id, notes, created_at, sale_date, creator_id,
					payment_type, payment_status
				 ) VALUES ($1, $2, $3, 0, $4, $5, 1, $6, $7, $8, $9, $9, $10, $11, 1)`,
				[
					saleId,
					number_of_items,
					total_amount,
					tenantId,
					invoice,
					customerId,
					warehouseId,
					'Demo seed sale',
					createdAt,
					userId,
					paymentType,
				]
			);

			for (const line of lines) {
				await client.query(
					`INSERT INTO saledetails (
						id, sale_id, product_id, quantity, unit_price, unit_cost,
						warehouse_id, tenant_id, creator_id, created_at
					 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
					[
						uuidv4(),
						saleId,
						line.product_id,
						line.quantity,
						line.unit_price,
						line.unit_cost,
						warehouseId,
						tenantId,
						userId,
						createdAt,
					]
				);
			}
			salesCount += 1;
		}

		// Expenses: a few per week
		if (rand() < (isWeekend ? 0.15 : 0.4)) {
			const tmpl = pick(rand, DEMO_EXPENSE_TEMPLATES);
			const [lo, hi] = tmpl.amount;
			const amount = money(lo + rand() * (hi - lo));
			const createdAt = new Date(day);
			createdAt.setHours(11 + randInt(rand, 0, 6), randInt(rand, 0, 59), 0, 0);
			await client.query(
				`INSERT INTO expenses (
					id, amount, description, note, category, payment_method, expense_date,
					expensed_by, tenant_id, creator_id, warehouse_id, created_at
				 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $7)`,
				[
					uuidv4(),
					amount,
					tmpl.description,
					'Demo seed expense',
					tmpl.category,
					tmpl.payment_method,
					createdAt,
					userId,
					tenantId,
					userId,
					warehouseId,
				]
			);
			expensesCount += 1;
		}

		day.setDate(day.getDate() + 1);
	}

	// Restore catalog stock levels so demos stay coherent after historical txs
	const skuPrefix = `D${String(tenantId).replace(/-/g, '').slice(0, 8)}`;
	for (const prod of DEMO_PRODUCTS) {
		const sku = `${skuPrefix}-${prod.sku}`;
		await client.query(
			`UPDATE products SET inventory = $1, updated_at = NOW() WHERE tenant_id = $2 AND sku = $3`,
			[prod.stock, tenantId, sku]
		);
		await client.query(
			`UPDATE inventories inv
			 SET quantity_available = $1, minimum_stock_level = $2, updated_at = NOW()
			 FROM products p
			 WHERE inv.product_id = p.id AND p.tenant_id = $3 AND p.sku = $4 AND inv.warehouse_id = $5`,
			[prod.stock, prod.reorder, tenantId, sku, warehouseId]
		);
	}

	return { salesCount, purchasesCount, expensesCount, from: start, to: end };
}

/**
 * @param {object} options
 * @param {string} options.email
 * @param {boolean} [options.wipe]
 * @param {boolean} [options.activityOnly]
 * @param {boolean} [options.noActivity]
 * @param {boolean} [options.keepTx]
 * @param {import('pg').Pool} [options.pool] - optional existing pool (caller closes it)
 */
export async function runDemoCatalogSeed(options = {}) {
	const email = String(options.email || 'test@shopynn.local').trim().toLowerCase();
	const wipe = Boolean(options.wipe);
	const activityOnly = Boolean(options.activityOnly);
	const keepTx = Boolean(options.keepTx);
	const withActivity = !options.noActivity;

	if (!wipe && !activityOnly) {
		throw new Error('runDemoCatalogSeed requires wipe or activityOnly');
	}

	const ownsPool = !options.pool;
	const db = options.pool || (await import('../src/config/db.js')).default;

	const account = await resolveAccount(db, email);
	console.log('Demo catalog / activity seed');
	console.log(`  Email:     ${account.email}`);
	console.log(`  Tenant:    ${account.tenant_name} (${account.tenant_id})`);
	console.log(`  Warehouse: ${account.warehouse_id}`);
	console.log(
		`  Mode:      ${activityOnly ? 'activity-only' : `wipe${keepTx ? ' (keep tx)' : ''}`}${withActivity ? ' + 6mo activity' : ' (no activity)'}`
	);

	const client = await db.connect();
	try {
		await client.query('BEGIN');

		if (activityOnly) {
			console.log('Wiping transactions + partners…');
			await wipeTransactions(client, account.tenant_id);
			await wipePartners(client, account.tenant_id);
		} else {
			console.log('Wiping existing catalog…');
			await wipeTenantCatalog(client, account.tenant_id, { keepTransactions: keepTx });
			console.log('Seeding Ghana retail demo products…');
			const count = await seedCatalog(client, {
				tenantId: account.tenant_id,
				userId: account.user_id,
				warehouseId: account.warehouse_id,
			});
			console.log(`  Products seeded: ${count}`);
		}

		if (withActivity) {
			if (!activityOnly && keepTx) {
				console.log('Skipping activity (--keep-tx).');
			} else {
				console.log('Seeding customers & suppliers…');
				const { customers, suppliers } = await seedPartners(client, {
					tenantId: account.tenant_id,
					userId: account.user_id,
				});
				console.log(`  Customers: ${customers.length}, suppliers: ${suppliers.length}`);
				console.log('Seeding ~6 months of sales / purchases / expenses…');
				const activity = await seedSixMonthActivity(client, {
					tenantId: account.tenant_id,
					userId: account.user_id,
					warehouseId: account.warehouse_id,
					customerIds: customers,
					supplierIds: suppliers,
				});
				console.log(
					`  Sales: ${activity.salesCount}, purchases: ${activity.purchasesCount}, expenses: ${activity.expensesCount}`
				);
				console.log(`  Range: ${activity.from.toISOString().slice(0, 10)} → ${activity.to.toISOString().slice(0, 10)}`);
			}
		}

		await client.query('COMMIT');
		console.log('');
		console.log('Done. Pull-to-refresh / re-sync on mobile.');
		return account;
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
		if (ownsPool) await db.end().catch(() => {});
	}
}

if (isCli) {
	const opts = parseCliOptions();
	if (!opts.wipe && !opts.activityOnly) {
		console.error('Refusing to run without --wipe or --activity-only.');
		console.error('Example: npm run seed:demo-catalog -w @shopynn/api -- --wipe');
		process.exit(1);
	}
	runDemoCatalogSeed(opts).catch((err) => {
		console.error('Demo catalog seed failed:', err.message || err);
		process.exitCode = 1;
	});
}