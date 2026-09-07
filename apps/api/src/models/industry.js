import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

export const createIndustryService = async (payload = {}) => {
    const { name, code = null, description = null, product_categorization = null } = payload;
    if (!name || !String(name).trim()) {
        throw new Error("name is required for industry.");
    }
    const id = uuidv4();
    const now = new Date();
    const result = await pool.query(
        `INSERT INTO industries (id, name, code, description, product_categorization, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING id, name, code, description, product_categorization, created_at, updated_at`,
        [id, String(name).trim(), code, description, product_categorization, now]
    );
    return result.rows[0];
};

export const getAllIndustriesService = async (requestQuery = {}) => {
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        conditions.push(`name ILIKE $${paramIndex}`);
        params.push(`%${String(search).trim()}%`);
        paramIndex++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
        `SELECT id, name, code, description, product_categorization, created_at, updated_at
         FROM industries
         ${where}
         ORDER BY name ASC`,
        params
    );
    return result.rows;
};

export const getIndustryByIdService = async (id) => {
    const result = await pool.query(
        `SELECT id, name, code, description, product_categorization, created_at, updated_at
         FROM industries
         WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
};

