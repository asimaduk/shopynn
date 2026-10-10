import pool from "../config/db.js";

/** True only for customer accounts: not a platform admin, no staff role, and a customer role or profile. */
export async function isCustomerOnlyAccount(userId, db = pool) {
    const r = await db.query(
        `SELECT
            u.user_type,
            EXISTS (
                SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = u.id AND lower(r.name) <> 'customer'
            ) AS has_staff_role,
            EXISTS (
                SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = u.id AND lower(r.name) = 'customer'
            ) OR EXISTS (
                SELECT 1 FROM customer_profiles cp WHERE cp.user_id = u.id
            ) AS is_customer
         FROM users u WHERE u.id = $1`,
        [userId]
    );
    const row = r.rows[0];
    return Boolean(row) && row.user_type !== 1 && !row.has_staff_role && row.is_customer;
}
