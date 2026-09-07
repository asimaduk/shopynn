import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';

export const getAllSuppliersService = async (user, requestQuery = {}) => {
    const conditions = ["suppliers.tenant_id = $1"];
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
    }

    const where = conditions.join(" AND ");
    const query = `SELECT * FROM suppliers WHERE ${where} ORDER BY suppliers.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
}

export const getSupplierByIdService = async (id) => {
    const result = await pool.query("SELECT * FROM suppliers where id = $1", [id]);
    return result.rows[0];
}

export const createSupplierService = async (payload) => {
    const { name, address, manager, tenant_id, phone, creator_id } = payload;
    const id = uuidv4();
    const result = await pool.query(`
        INSERT INTO suppliers (id, name, address, manager, tenant_id, phone, creator_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [id, name, address, manager, tenant_id, phone, creator_id, new Date(), new Date()]
    );

    return result.rows[0];
}

export const updateSupplierService = async (payload) => {
    const { id, name, address, manager, phone } = payload;
    const result = await pool.query(`
        UPDATE suppliers SET name=$1, address=$2, manager=$3, phone=$4, updated_at=$5 WHERE id=$6 RETURNING *`,
        [name, address, manager, phone, new Date(), id]
    );

    return result.rows[0];
}

//to be reviewed
export const deleteSupplierService = async (id) => {
    const result = await pool.query(`
        UPDATE suppliers SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}