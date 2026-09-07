import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { onboardSubscriptionService } from "./subscription.js";
import { createUserService } from "./user.js";
import { assertShopOwnerEmailVerified } from "./emailVerification.js";

/**
 * Create a tenant, then create and link a subscription (onboardSubscriptionService flow), then create a user.
 * Payload: tenant fields (name, organization, phone, notes?, product_categorization?, industry_id?), subscription_type (1-4), user fields (first_name, last_name, email, phone?).
 * If user phone is omitted, tenant phone is used.
 */
export const createTenantService = async (payload) => {
    const {
        name,
        organization,
        phone,
        notes,
        address,
        city,
        state,
        country,
        postal_code,
        website,
        logo,
        product_categorization,
        industry_id,
        creator_id,
        subscription_type,
        first_name,
        last_name,
        email,
        registration_method,
        password,
        owner_email,
        owner_phone,
        verification_token,
        skip_owner_email_verification,
    } = payload;

    // if (!name || !phone) {
    //     throw new Error("name and phone are required.");
    // }
    if (subscription_type === undefined || subscription_type === null) {
        throw new Error("subscription_type is required (1=Free, 2=Basic, 3=Standard, 4=Premium).");
    }
    const userEmailRaw =
        owner_email != null && String(owner_email).trim() !== ""
            ? owner_email
            : email;
    if (!first_name || !last_name || !userEmailRaw || !String(userEmailRaw).trim()) {
        throw new Error("first_name, last_name and email (or owner_email) are required for the initial user.");
    }

    const normalizedUserEmail = String(userEmailRaw).trim().toLowerCase();

    if (!skip_owner_email_verification) {
        await assertShopOwnerEmailVerified(normalizedUserEmail, verification_token);
    }

    const tenantEmailForInsert =
        email != null && String(email).trim() !== "" ? String(email).trim() : null;
    const normalizedPhone =
        phone != null && String(phone).trim() !== "" ? String(phone).trim() : null;
    const userPhoneForInsert =
        owner_phone != null && String(owner_phone).trim() !== ""
            ? String(owner_phone).trim()
            : normalizedPhone;

    const existingEmail = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [normalizedUserEmail]);
    if (existingEmail.rowCount > 0) {
        throw new Error("An account with this email already exists.");
    }

    if (userPhoneForInsert) {
        const existingUserPhone = await pool.query(`SELECT id FROM users WHERE phone = $1 LIMIT 1`, [
            userPhoneForInsert,
        ]);
        if (existingUserPhone.rowCount > 0) {
            throw new Error("An account with this phone number already exists.");
        }
    }

    if (normalizedPhone) {
        const existingTenantPhone = await pool.query(`SELECT id FROM tenants WHERE phone = $1 LIMIT 1`, [
            normalizedPhone,
        ]);
        if (existingTenantPhone.rowCount > 0) {
            throw new Error("This phone number is already registered to another organization.");
        }
    }

    const id = uuidv4();
    const now = new Date();
    await pool.query(
        `INSERT INTO tenants (id, name, organization, phone, email, notes, address, city, state, country, postal_code, website, logo, product_categorization, industry_id, creator_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
            id,
            name || null,
            organization || null,
            phone || null,
            tenantEmailForInsert,
            notes ?? null,
            address ?? null,
            city ?? null,
            state ?? null,
            country ?? null,
            postal_code ?? null,
            website ?? null,
            logo ?? null,
            product_categorization ?? null,
            industry_id ?? null,
            creator_id ?? null,
            now,
            now,
        ]
    );

    const subscription = await onboardSubscriptionService(id, subscription_type);

    const userPayload = {
        first_name,
        last_name,
        email: normalizedUserEmail,
        tenant_id: id,
        phone: userPhoneForInsert,
        registration_method,
        isOnboarding: true,
        password,
    };

    // console.log('userPayload', userPayload);

    const userResult = await createUserService(userPayload);
    if (!userResult || !userResult.id) {
        throw new Error(userResult?.message || "User creation failed.");
    }

    const row = await pool.query("SELECT * FROM tenants WHERE id = $1", [id]);
    return {
        tenant: row.rows[0],
        subscription: { id: subscription.id, name: subscription.name, amount: subscription.amount, billing_interval: subscription.billing_interval, status: subscription.status, start_at: subscription.start_at, end_at: subscription.end_at },
        user: { id: userResult.id },
    };
};

/**
 * List tenants with optional name search and date filtering.
 * Query: name/search/q (ILIKE on name, organization), startDate/endDate or from/to (created_at).
 */
export const getAllTenantsService = async (requestQuery = {}) => {
    const conditions = ["1=1"];
    const params = [];
    let paramIndex = 1;

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        conditions.push(`(t.name ILIKE $${paramIndex} OR t.organization ILIKE $${paramIndex})`);
        params.push(`%${String(search).trim()}%`);
        paramIndex++;
    }

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`t.created_at::date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    } else if (requestQuery.from && requestQuery.to) {
        conditions.push(`t.created_at::date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.from, requestQuery.to);
        paramIndex += 2;
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT t.id, t.name, t.organization, t.phone, t.notes, t.product_categorization, t.subscription_id, t.created_at, t.updated_at,
               s.name AS subscription_name, s.status AS subscription_status, s.end_at AS subscription_end_at
        FROM tenants t
        LEFT JOIN subscriptions s ON t.subscription_id = s.id
        WHERE ${where}
        ORDER BY t.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * Get tenant by id.
 */
export const getTenantByIdService = async (id) => {
    const result = await pool.query(
        `SELECT t.id, t.name, t.organization, t.phone, t.notes, t.product_categorization, t.subscription_id, t.created_at, t.updated_at,
                s.name AS subscription_name, s.status AS subscription_status, s.end_at AS subscription_end_at
         FROM tenants t
         LEFT JOIN subscriptions s ON t.subscription_id = s.id
         WHERE t.id = $1`,
        [id]
    );
    return result.rows[0] || null;
};

/**
 * Update tenant by id. Only provided fields are updated.
 * If setup_inventory is true, creates a new warehouse (using payload.warehouse_name or "Default Warehouse"),
 * then creates inventory rows for all products that match tenant's product_categorization for that warehouse only.
 *
 * @param {string} tenant_id - Tenant UUID.
 * @param {Object} payload - Partial tenant fields: name, organization, phone, notes, address, email, city, state, country, postal_code, website, logo, product_categorization, industry_id, warehouse_name (used when setup_inventory is true).
 * @param {Object} [options] - Options.
 * @param {boolean} [options.setup_inventory=false] - If true, create a new warehouse and inventories for products matching tenant's product_categorization.
 * @param {string|null} [options.creator_id=null] - User ID for warehouse/inventory creator_id.
 * @returns {Promise<Object|null>} Updated tenant row; when setup_inventory was true, includes inventories_created (number).
 */
export const updateTenantService = async (tenant_id, payload, options = {}) => {
    const { setup_inventory = false, creator_id = null } = options;
    const { name, organization, phone, notes, address, email, city, state, country, postal_code, website, logo, product_categorization, industry_id, warehouse_name } = payload;

    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (organization !== undefined) { updates.push(`organization = $${i++}`); values.push(organization); }
    if (phone !== undefined) { updates.push(`phone = $${i++}`); values.push(String(phone).trim()); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); values.push(notes); }
    if (address !== undefined) { updates.push(`address = $${i++}`); values.push(address); }
    if (email !== undefined) { updates.push(`email = $${i++}`); values.push(email); }
    if (city !== undefined) { updates.push(`city = $${i++}`); values.push(city); }
    if (state !== undefined) { updates.push(`state = $${i++}`); values.push(state); }
    if (country !== undefined) { updates.push(`country = $${i++}`); values.push(country); }
    if (postal_code !== undefined) { updates.push(`postal_code = $${i++}`); values.push(postal_code); }
    if (website !== undefined) { updates.push(`website = $${i++}`); values.push(website); }
    if (logo !== undefined) { updates.push(`logo = $${i++}`); values.push(logo); }
    if (product_categorization !== undefined) { updates.push(`product_categorization = $${i++}`); values.push(product_categorization); }
    if (industry_id !== undefined) { updates.push(`industry_id = $${i++}`); values.push(industry_id); }
    if (creator_id !== undefined) { updates.push(`updator_id = $${i++}`); values.push(creator_id); }
    if (updates.length === 0 && !setup_inventory) {
        const row = await pool.query("SELECT * FROM tenants WHERE id = $1", [tenant_id]);
        return row.rows[0] || null;
    }

    if (updates.length > 0) {
        updates.push(`updated_at = $${i}`);
        values.push(new Date());
        i++;
        values.push(tenant_id);
        await pool.query(
            `UPDATE tenants SET ${updates.join(", ")} WHERE id = $${i}`,
            values
        );
    }

    // let inventoriesCreated = 0;
    // if (setup_inventory) {
    //     const warehouseId = uuidv4();
    //     const warehouseName = warehouse_name || "Default Warehouse";
    //     const now = new Date();
    //     await pool.query(
    //         `INSERT INTO warehouses (id, name, tenant_id, created_at, updated_at, manager, phone, address, is_refrigerated, creator_id)
    //          VALUES ($1, $2, $3, $4, $4, NULL, NULL, NULL, false, $5)`,
    //         [warehouseId, warehouseName, tenant_id, now, creator_id]
    //     );


    //     let cat = null;
    //     if (industry_id) {
    //         const industryRow = await pool.query(
    //             "SELECT product_categorization FROM industries WHERE id = $1",
    //             [industry_id]
    //         );

    //         if (industryRow.rows.length > 0) {
    //             cat = industryRow.rows[0].product_categorization;
    //         }
    //     }

    //     const productsResult = await pool.query(
    //         `SELECT id FROM products WHERE product_categorization = $1`,
    //         [cat]
    //     );

    //     for (const prod of productsResult.rows) {
    //         const exists = await pool.query(
    //             "SELECT 1 FROM inventories WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $3 LIMIT 1",
    //             [prod.id, warehouseId, tenant_id]
    //         );
    //         if (exists.rows.length > 0) continue;
    //         const invId = uuidv4();
    //         await pool.query(
    //             `INSERT INTO inventories (id, quantity_available, minimum_stock_level, tenant_id, product_id, warehouse_id, creator_id, created_at, updated_at)
    //              VALUES ($1, 0, 0, $2, $3, $4, $5, $6, $6)`,
    //             [invId, tenant_id, prod.id, warehouseId, creator_id, now]
    //         );
    //         inventoriesCreated++;
    //     }
    // }

    const row = await pool.query(
        `SELECT id, name, organization, phone, email, notes, address, city, state, country, postal_code, website, logo, product_categorization, industry_id, created_at, updated_at
         FROM tenants WHERE id = $1`,
        [tenant_id]
    );
    return row.rows[0] || null;
};

/**
 * Admin directory: all tenants with subscription, industry, and counts.
 * Query: name/search/q, startDate/endDate or from/to (created_at).
 */
export const listTenantsDirectoryService = async (requestQuery = {}) => {
    const conditions = ["1=1"];
    const params = [];
    let paramIndex = 1;

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        conditions.push(
            `(t.name ILIKE $${paramIndex} OR t.organization ILIKE $${paramIndex} OR t.email ILIKE $${paramIndex} OR t.phone ILIKE $${paramIndex})`
        );
        params.push(`%${String(search).trim()}%`);
        paramIndex++;
    }

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`t.created_at::date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    } else if (requestQuery.from && requestQuery.to) {
        conditions.push(`t.created_at::date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.from, requestQuery.to);
        paramIndex += 2;
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT
            t.id,
            t.name,
            t.organization,
            t.phone,
            t.email,
            t.city,
            t.state,
            t.country,
            t.address,
            (
                SELECT COUNT(*)::int
                FROM users u
                INNER JOIN merchants m ON m.user_id = u.id
                WHERE u.tenant_id = t.id
                  AND COALESCE(u.deleted, false) = false
            ) AS merchant_count,
            t.subscription_id,
            t.created_at,
            t.updated_at,
            s.name AS subscription_name,
            s.status AS subscription_status,
            s.amount AS subscription_amount,
            s.start_at AS subscription_start_at,
            s.end_at AS subscription_end_at,
            i.name AS industry_name,
            (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id AND COALESCE(u.deleted, false) = false) AS user_count,
            (SELECT COUNT(*)::int FROM warehouses w WHERE w.tenant_id = t.id) AS warehouse_count
        FROM tenants t
        LEFT JOIN subscriptions s ON t.subscription_id = s.id
        LEFT JOIN industries i ON t.industry_id = i.id
        WHERE ${where}
        ORDER BY t.created_at DESC
    `;
    const result = await pool.query(query, params);
    // console.log('result',result.rows);
    return result.rows;
};

/**
 * Admin directory detail: tenant + subscription + stats + recent payments.
 */
export const getTenantDirectoryDetailService = async (tenantId) => {
    const tenantRes = await pool.query(
        `SELECT
            t.*,
            i.name AS industry_name,
            (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id AND COALESCE(u.deleted, false) = false) AS user_count,
            (SELECT COUNT(*)::int FROM warehouses w WHERE w.tenant_id = t.id) AS warehouse_count,
            (
                SELECT COUNT(*)::int
                FROM users u
                INNER JOIN merchants m ON m.user_id = u.id
                WHERE u.tenant_id = t.id
                  AND COALESCE(u.deleted, false) = false
            ) AS merchant_count
         FROM tenants t
         LEFT JOIN industries i ON t.industry_id = i.id
         WHERE t.id = $1`,
        [tenantId]
    );
    const tenant = tenantRes.rows[0] || null;
    if (!tenant) return null;

    let subscription = null;
    if (tenant.subscription_id) {
        const subRes = await pool.query(
            `SELECT id, name, description, amount, billing_interval, status, start_at, end_at, features, created_at, updated_at
             FROM subscriptions WHERE id = $1`,
            [tenant.subscription_id]
        );
        subscription = subRes.rows[0] || null;
        if (subscription?.amount != null) subscription.amount = Number(subscription.amount);
    }

    const payRes = await pool.query(
        `SELECT id, amount, payment_method_type, transaction_ref, status, created_at
         FROM payments
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 15`,
        [tenantId]
    );
    const recentPayments = payRes.rows.map((row) => ({
        id: row.id,
        amount: row.amount != null ? Number(row.amount) : null,
        payment_method_type: row.payment_method_type,
        transaction_ref: row.transaction_ref,
        status: row.status,
        created_at: row.created_at,
    }));

    return { tenant, subscription, recentPayments };
};
