import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';

export const getAllExpensesService = async (user, requestQuery = {}) => {
    const conditions = ["expenses.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`expenses.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        const term = `%${String(search).trim()}%`;
        conditions.push(`(expenses.description ILIKE $${paramIndex} OR expenses.note ILIKE $${paramIndex} OR expenses.category ILIKE $${paramIndex})`);
        params.push(term);
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT 
            expenses.amount,
            expenses.description,
            expenses.note,
            expenses.category,
            expenses.payment_method,
            expenses.expensed_by,
            expenses.expense_date,
            expenses.created_at,
            warehouses.name AS warehouse,
            u.first_name AS creator_first_name,
            u.last_name AS creator_last_name
        FROM expenses
        LEFT JOIN warehouses ON expenses.warehouse_id = warehouses.id
        LEFT JOIN users u ON expenses.creator_id = u.id
        WHERE ${where}
        ORDER BY expenses.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
}

export const getExpenseByIdService = async (id) => {
    const result = await pool.query("SELECT id, amount, description, note, category, payment_method, expensed_by, expense_date, created_at FROM expenses where id = $1", [id]);
    return result.rows[0];
}

export const createExpenseService = async (payload) => {
    const { amount, description, note, category, payment_method, expense_date, expensed_by, tenant_id, creator_id, warehouse_id } = payload;
    console.log('createExpenseService payload',payload);
    const id = uuidv4();
    const result = await pool.query(`
        INSERT INTO expenses (id, amount, description, note, category, payment_method, expense_date, expensed_by, tenant_id, creator_id, warehouse_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [id, amount, description || null, note, category, payment_method || null, expense_date, expensed_by, tenant_id, creator_id, warehouse_id, new Date()]
    );

    return result.rows[0];
}

export const updateExpenseService = async (payload) => {
    const { id, note } = payload;
    const result = await pool.query(`
        UPDATE expenses SET note=$1 updated_at=$2 WHERE id=$3 RETURNING *`,
        [ note, new Date(), id]
    );

    return result.rows[0];
}

//to be reviewed
// export const deleteLocationService = async (id) => {
//     const result = await pool.query(`
//         UPDATE locations SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
//         [ false, new Date(), id]
//     );

//     return result.rows[0];
// }