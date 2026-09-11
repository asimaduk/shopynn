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
 * With `limit`/`pageSize`: returns `{ items, total, limit, offset }`.
 * Without: returns a plain array (backward compatible).
 */
export const getAllSuppliersService = async (user, requestQuery = {}) => {
	const conditions = ['suppliers.tenant_id = $1'];
	const params = [user.tenant_id];
	let paramIndex = 2;

	if (requestQuery.startDate && requestQuery.endDate) {
		conditions.push(`suppliers.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
		params.push(requestQuery.startDate, requestQuery.endDate);
		paramIndex += 2;
	}

	const nameSearch = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
	if (nameSearch && String(nameSearch).trim()) {
		conditions.push(`suppliers.name ILIKE $${paramIndex}`);
		params.push(`%${String(nameSearch).trim()}%`);
		paramIndex += 1;
	}

	const where = conditions.join(' AND ');
	const selectSql = `SELECT * FROM suppliers WHERE ${where} ORDER BY suppliers.created_at DESC`;

	const pagination = parsePagination(requestQuery);
	if (!pagination) {
		const result = await pool.query(selectSql, params);
		return result.rows;
	}

	const countResult = await pool.query(
		`SELECT COUNT(*)::int AS total FROM suppliers WHERE ${where}`,
		params
	);
	const total = Number(countResult.rows[0]?.total || 0);

	const pageResult = await pool.query(
		`${selectSql} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
		[...params, pagination.limit, pagination.offset]
	);

	return {
		items: pageResult.rows,
		total,
		limit: pagination.limit,
		offset: pagination.offset,
	};
};

export const getSupplierByIdService = async (id) => {
	const result = await pool.query('SELECT * FROM suppliers where id = $1', [id]);
	return result.rows[0];
};

export const createSupplierService = async (payload) => {
	const { name, address, manager, tenant_id, phone, creator_id } = payload;
	const id = uuidv4();
	const result = await pool.query(
		`
        INSERT INTO suppliers (id, name, address, manager, tenant_id, phone, creator_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
		[id, name, address, manager, tenant_id, phone, creator_id, new Date(), new Date()]
	);

	return result.rows[0];
};

export const updateSupplierService = async (payload) => {
	const { id, name, address, manager, phone } = payload;
	const result = await pool.query(
		`
        UPDATE suppliers SET name=$1, address=$2, manager=$3, phone=$4, updated_at=$5 WHERE id=$6 RETURNING *`,
		[name, address, manager, phone, new Date(), id]
	);

	return result.rows[0];
};

export const deleteSupplierService = async (id) => {
	const result = await pool.query(
		`
        UPDATE suppliers SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
		[false, new Date(), id]
	);

	return result.rows[0];
};
