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

/**
 * Merged directory: POS/admin `customers` rows (`source: 'pos'`) plus
 * self-registered shoppers (`customer_profiles` + `users`, `source: 'account'`).
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

	const posConditions = ['c.tenant_id = $1'];
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
	const posWhere = posConditions.join(' AND ');

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
	const accWhere = accConditions.join(' AND ');

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
		return [...posResult.rows, ...accResult.rows].sort(
			(a, b) => new Date(b.created_at) - new Date(a.created_at)
		);
	}

	// Single UNION with remapped account placeholders ($1..$n → $(n+posLen)..)
	const shift = posParams.length;
	const remappedAccWhere = accWhere.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + shift}`);
	const accSelectUnion = `
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
            'account'::text AS source,
            u.id AS user_id
        FROM customer_profiles cp
        INNER JOIN users u ON u.id = cp.user_id
        WHERE ${remappedAccWhere}`;

	const unionParams = [...posParams, ...accParams];
	const unionSql = `(${posSelect}) UNION ALL (${accSelectUnion})`;

	const countResult = await pool.query(
		`SELECT COUNT(*)::int AS total FROM (${unionSql}) AS merged`,
		unionParams
	);
	const total = Number(countResult.rows[0]?.total || 0);

	const limIdx = unionParams.length + 1;
	const pageResult = await pool.query(
		`SELECT * FROM (${unionSql}) AS merged
		 ORDER BY created_at DESC NULLS LAST
		 LIMIT $${limIdx} OFFSET $${limIdx + 1}`,
		[...unionParams, pagination.limit, pagination.offset]
	);

	return {
		items: pageResult.rows,
		total,
		limit: pagination.limit,
		offset: pagination.offset,
	};
};

export const getCustomerByIdService = async (tenantId, id) => {
	const pos = await pool.query(
		`SELECT id, name, email, address, notes, phone, customer_group, is_active, created_at,
                'pos'::text AS source, NULL::varchar AS user_id
         FROM customers
         WHERE id = $1 AND tenant_id = $2`,
		[id, tenantId]
	);
	if (pos.rows[0]) return pos.rows[0];

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
	return acc.rows[0] ?? null;
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
