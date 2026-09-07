import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';

export const getAllCategoriesService = async (user, requestQuery = {}) => {
    const conditions = ["categories.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`categories.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const nameSearch = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (nameSearch && String(nameSearch).trim()) {
        conditions.push(`categories.name ILIKE $${paramIndex}`);
        params.push(`%${String(nameSearch).trim()}%`);
    }

    const where = conditions.join(" AND ");
    // const query = `SELECT id, name, description, is_active AS active FROM categories WHERE ${where} ORDER BY categories.updated_at DESC`;

    const query = `
        SELECT 
            c.id,
            c.name,
            c.description,
            c.is_active AS active,
            COALESCE(COUNT(DISTINCT p.id), 0)::int AS product_count
        FROM categories c
        LEFT JOIN products p
            ON p.tenant_id = c.tenant_id
        AND c.id = ANY(p.categories)
        WHERE ${where.replace(/categories\./g, "c.")}
        GROUP BY c.id, c.name, c.description, c.is_active
        ORDER BY c.updated_at DESC
    `;
    
    const result = await pool.query(query, params);
    // console.log('result',result.rows);
    return result.rows;
}

export const getCategoryByIdService = async (id) => {
    const result = await pool.query("SELECT id, name, description, is_active AS active FROM categories where id = $1 AND is_active=true", [id]);
    return result.rows[0];
}

export const createCategoryService = async (payload) => {
    const { name, description, creator_id, tenant_id } = payload;
    const id = uuidv4();
    const result = await pool.query(`
        INSERT INTO categories (id, name, description, creator_id, tenant_id, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [id, name, description, creator_id, tenant_id, true, new Date()]
    );

    return result.rows[0];
}

export const updateCategoryService = async (payload) => {
    const { id, name, description, active } = payload;
    // Dynamically build the SET clause and params to update available fields only
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (typeof name !== "undefined") {
        setClauses.push(`name=$${paramIndex++}`);
        params.push(name);
    }
    if (typeof description !== "undefined") {
        setClauses.push(`description=$${paramIndex++}`);
        params.push(description);
    }
    if (typeof active !== "undefined") {
        setClauses.push(`is_active=$${paramIndex++}`);
        params.push(active);
    }

    setClauses.push(`updated_at=$${paramIndex}`);
    params.push(new Date());

    params.push(id);

    const query = `
        UPDATE categories 
        SET ${setClauses.join(", ")}
        WHERE id=$${paramIndex + 1}
        RETURNING id
    `;

    const result = await pool.query(query, params);

    return result.rows[0];
}

//to be reviewed
export const deleteCategoryService = async (id) => {
    // Check if the category has associated products
    const productCountResult = await pool.query(
        `SELECT COUNT(*) AS count FROM products WHERE $1 = ANY(categories) AND is_active = true`,
        [id]
    );
    const productCount = parseInt(productCountResult.rows[0]?.count ?? '0', 10);

    if (productCount > 0) {
        // Category has products, don't delete, return info
        return { has_products: true, product_count: productCount };
    }

    const result = await pool.query(`
        UPDATE categories SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING id`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}