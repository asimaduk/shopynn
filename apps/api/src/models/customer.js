import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';

function parsePagination(requestQuery = {}) {
	const limitRaw = requestQuery.limit ?? requestQuery.pageSize;
	const hasLimit = limitRaw !== undefined && limitRaw !== null && String(limitRaw).trim() !== '';
	if (!hasLimit) return null;
	let limit = parseInt(limitRaw, 10);
	if (Number.isNaN(limit) || limit <= 0) limit = 20;
	if (limit > 100) limit = 100;
	let offset = parseInt(requestQuery.offset ?? requestQuery.skip ?? 0, 10);
	if (Number.isNaN(offset) || offset < 0) offset = 0;
	return { limit, offset };
}

const normalizePhoneKey = (phone) => String(phone || "").replace(/\D/g, "");
const normalizeEmailKey = (email) => {
	const e = String(email || "").trim().toLowerCase();
	if (!e || e.endsWith("@otp.shopynn.local")) return "";
	return e;
};

/**
 * One person should appear once in the directory.
 * Prefer app-signup (`account`) over POS twin; carry store credit / loyalty from the POS row.
 */
function dedupeMergedCustomers(rows = []) {
	const byKey = new Map();
	const rank = (source) => (String(source).toLowerCase() === "account" ? 2 : 1);

	const identityKeys = (row) => {
		const keys = [];
		const phone = normalizePhoneKey(row?.phone);
		const email = normalizeEmailKey(row?.email);
		if (phone.length >= 9) keys.push(`p:${phone}`);
		if (email) keys.push(`e:${email}`);
		if (!keys.length) keys.push(`id:${row?.id}`);
		return keys;
	};

	for (const raw of rows) {
		if (!raw?.id) continue;
		const row = {
			...raw,
			store_credit_balance: Number(raw.store_credit_balance) || 0,
			loyalty_points: Number(raw.loyalty_points) || 0,
		};
		const keys = identityKeys(row);
		let placed = false;
		for (const key of keys) {
			const existing = byKey.get(key);
			if (!existing) continue;
			placed = true;
			if (rank(row.source) > rank(existing.source)) {
				byKey.set(key, {
					...row,
					store_credit_balance: Math.max(row.store_credit_balance, existing.store_credit_balance),
					loyalty_points: Math.max(row.loyalty_points, existing.loyalty_points),
				});
			} else if (rank(row.source) < rank(existing.source)) {
				byKey.set(key, {
					...existing,
					store_credit_balance: Math.max(existing.store_credit_balance, row.store_credit_balance),
					loyalty_points: Math.max(existing.loyalty_points, row.loyalty_points),
				});
			} else {
				// Same source duplicate — keep newer
				const keep =
					new Date(row.created_at || 0) >= new Date(existing.created_at || 0) ? row : existing;
				byKey.set(key, keep);
			}
			// Keep all keys for this identity pointing at the winner
			const winner = byKey.get(key);
			for (const k of identityKeys(winner)) byKey.set(k, winner);
			break;
		}
		if (!placed) {
			for (const key of keys) byKey.set(key, row);
		}
	}

	const unique = [];
	const seenIds = new Set();
	for (const row of byKey.values()) {
		if (seenIds.has(row.id)) continue;
		seenIds.add(row.id);
		unique.push(row);
	}
	return unique;
}

/**
 * Merged directory: POS/admin `customers` rows (`source: 'pos'`) plus
 * self-registered shoppers (`customer_profiles` + `users`, `source: 'account'`).
 * POS rows auto-created as sale mirrors of app-signup profiles are hidden; credit is
 * surfaced on the account row instead.
 *
 * With `limit`/`pageSize`: returns `{ items, total, limit, offset }`.
 * Without: returns a plain array (backward compatible).
 */
export const getAllCustomersService = async (user, requestQuery = {}) => {
	const tenantId = user.tenant_id;
	const nameSearch = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
	const searchPattern = nameSearch && String(nameSearch).trim() ? `%${String(nameSearch).trim()}%` : null;
	const hasDate = Boolean(requestQuery.startDate && requestQuery.endDate);
	const pagination = parsePagination(requestQuery);

	const posConditions = [
		"c.tenant_id = $1",
		"COALESCE(c.deleted, false) = false",
		// Hide POS mirrors of app-signup profiles (shown via the account row instead).
		"c.customer_profile_id IS NULL",
		"COALESCE(c.notes, '') NOT ILIKE 'Linked from app signup profile%'",
	];
	const posParams = [tenantId];
	let pi = 2;
	if (hasDate) {
		posConditions.push(`c.created_at BETWEEN $${pi} AND $${pi + 1}`);
		posParams.push(requestQuery.startDate, requestQuery.endDate);
		pi += 2;
	}
	if (searchPattern) {
		posConditions.push(`c.name ILIKE $${pi}`);
		posParams.push(searchPattern);
		pi += 1;
	}
	const posWhere = posConditions.join(" AND ");

	const accConditions = ["cp.tenant_id = $1", "cp.profile_type = 'customer'"];
	const accParams = [tenantId];
	let qi = 2;
	if (hasDate) {
		accConditions.push(`cp.created_at BETWEEN $${qi} AND $${qi + 1}`);
		accParams.push(requestQuery.startDate, requestQuery.endDate);
		qi += 2;
	}
	if (searchPattern) {
		accConditions.push(`(
            trim(concat_ws(' ', coalesce(u.first_name, ''), coalesce(u.last_name, ''))) ILIKE $${qi}
            OR u.email ILIKE $${qi}
            OR coalesce(u.phone, '') ILIKE $${qi}
        )`);
		accParams.push(searchPattern);
		qi += 1;
	}
	const accWhere = accConditions.join(" AND ");

	const posSelect = `
        SELECT
            c.id,
            c.name,
            c.email,
            c.address,
            c.phone,
            c.notes,
            c.created_at,
            c.is_active,
            c.customer_group,
            COALESCE(c.store_credit_balance, 0)::numeric AS store_credit_balance,
            COALESCE(c.loyalty_points, 0)::int AS loyalty_points,
            'pos'::text AS source,
            NULL::varchar AS user_id
        FROM customers c
        WHERE ${posWhere}`;

	const accSelect = `
        SELECT
            cp.id,
            trim(concat_ws(' ', coalesce(u.first_name, ''), coalesce(u.last_name, ''))) AS name,
            u.email,
            NULL::varchar AS address,
            u.phone AS phone,
            NULL::varchar AS notes,
            cp.created_at,
            u.is_active,
            NULL::varchar AS customer_group,
            COALESCE((
                SELECT c.store_credit_balance
                FROM customers c
                WHERE c.tenant_id = cp.tenant_id
                  AND COALESCE(c.deleted, false) = false
                  AND (
                    c.customer_profile_id = cp.id
                    OR (u.phone IS NOT NULL AND btrim(u.phone) <> '' AND c.phone = u.phone)
                    OR (
                        u.email IS NOT NULL
                        AND lower(u.email) NOT LIKE '%@otp.shopynn.local'
                        AND lower(c.email) = lower(u.email)
                    )
                  )
                ORDER BY
                    CASE WHEN c.customer_profile_id = cp.id THEN 0 ELSE 1 END,
                    c.updated_at DESC NULLS LAST
                LIMIT 1
            ), 0)::numeric AS store_credit_balance,
            COALESCE((
                SELECT c.loyalty_points
                FROM customers c
                WHERE c.tenant_id = cp.tenant_id
                  AND COALESCE(c.deleted, false) = false
                  AND (
                    c.customer_profile_id = cp.id
                    OR (u.phone IS NOT NULL AND btrim(u.phone) <> '' AND c.phone = u.phone)
                    OR (
                        u.email IS NOT NULL
                        AND lower(u.email) NOT LIKE '%@otp.shopynn.local'
                        AND lower(c.email) = lower(u.email)
                    )
                  )
                ORDER BY
                    CASE WHEN c.customer_profile_id = cp.id THEN 0 ELSE 1 END,
                    c.updated_at DESC NULLS LAST
                LIMIT 1
            ), 0)::int AS loyalty_points,
            'account'::text AS source,
            u.id AS user_id
        FROM customer_profiles cp
        INNER JOIN users u ON u.id = cp.user_id
        WHERE ${accWhere}`;

	if (!pagination) {
		const [posResult, accResult] = await Promise.all([
			pool.query(posSelect, posParams),
			pool.query(accSelect, accParams),
		]);
		return dedupeMergedCustomers([...posResult.rows, ...accResult.rows]).sort(
			(a, b) => new Date(b.created_at) - new Date(a.created_at)
		);
	}

	// Single UNION with remapped account placeholders ($1..$n → $(n+posLen)..)
	const shift = posParams.length;
	const remappedAccWhere = accWhere.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + shift}`);
	const accSelectUnion = accSelect.replace(accWhere, remappedAccWhere);

	const unionParams = [...posParams, ...accParams];
	const unionSql = `(${posSelect}) UNION ALL (${accSelectUnion})`;

	const allMerged = await pool.query(
		`SELECT * FROM (${unionSql}) AS merged
		 ORDER BY created_at DESC NULLS LAST`,
		unionParams
	);
	const deduped = dedupeMergedCustomers(allMerged.rows).sort(
		(a, b) => new Date(b.created_at) - new Date(a.created_at)
	);
	const total = deduped.length;
	const items = deduped.slice(pagination.offset, pagination.offset + pagination.limit);

	return {
		items,
		total,
		limit: pagination.limit,
		offset: pagination.offset,
	};
};

export const getCustomerByIdService = async (tenantId, id) => {
	const pos = await pool.query(
		`SELECT id, name, email, address, notes, phone, customer_group, is_active, created_at,
                COALESCE(store_credit_balance, 0)::numeric AS store_credit_balance,
                COALESCE(loyalty_points, 0)::int AS loyalty_points,
                'pos'::text AS source, NULL::varchar AS user_id
         FROM customers
         WHERE id = $1 AND tenant_id = $2`,
		[id, tenantId]
	);
	if (pos.rows[0]) {
		return {
			...pos.rows[0],
			store_credit_balance: Number(pos.rows[0].store_credit_balance) || 0,
			loyalty_points: Number(pos.rows[0].loyalty_points) || 0,
		};
	}

	const acc = await pool.query(
		`SELECT cp.id,
                trim(concat_ws(' ', coalesce(u.first_name, ''), coalesce(u.last_name, ''))) AS name,
                u.email,
                NULL::varchar AS address,
                u.phone AS phone,
                NULL::varchar AS notes,
                NULL::varchar AS customer_group,
                u.is_active,
                cp.created_at,
                'account'::text AS source,
                u.id AS user_id
         FROM customer_profiles cp
         INNER JOIN users u ON u.id = cp.user_id
         WHERE cp.id = $1 AND cp.tenant_id = $2 AND cp.profile_type = 'customer'`,
		[id, tenantId]
	);
	return acc.rows[0]
		? { ...acc.rows[0], store_credit_balance: 0, loyalty_points: 0 }
		: null;
};

export const createCustomerService = async (payload) => {
	const { name, email, address, phone, customer_group, tenant_id, creator_id, notes } = payload;
	const id = uuidv4();
	const result = await pool.query(
		`
        INSERT INTO customers (id, name, email, address, phone, customer_group, tenant_id, creator_id, created_at, is_active, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
		[id, name, email, address, phone, customer_group, tenant_id, creator_id, new Date(), true, notes]
	);

	return result.rows[0];
};

export const updateCustomerService = async (payload, tenantId) => {
	const { id, name, email, address, phone, notes } = payload;
	const result = await pool.query(
		`
        UPDATE customers SET name=$1, email=$2, address=$3, phone=$4, notes=$5, updated_at=$6 WHERE id=$7 AND tenant_id=$8 RETURNING id`,
		[name, email, address, phone, notes, new Date(), id, tenantId]
	);

	return result.rows[0];
};

export const deleteCustomerService = async (tenantId, id) => {
	const result = await pool.query(
		`
        UPDATE customers SET is_active=$1, updated_at=$2  WHERE id=$3 AND tenant_id=$4 RETURNING id`,
		[false, new Date(), id, tenantId]
	);

	return result.rows[0];
};
