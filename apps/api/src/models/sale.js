import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';
import { sendEmailService } from "./mail.js";
import { getUserPermissionsService, getUsersWithPermissionCodesForTenant } from "./userRole.js";

const canViewAllSalesForUser = async (user) => {
    if (user.user_type === 1) return true;
    const permissionCodes = Array.isArray(user.permissions)
        ? user.permissions
        : await getUserPermissionsService(user.id, user.tenant_id).catch(() => []);
    return permissionCodes.includes("sales.view_all");
};



export const getAllSalesService = async (user, requestQuery = {}) => {
    const conditions = ["sales.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    let canViewAll = false;
    
    const permissionCodes = Array.isArray(user.permissions)
        ? user.permissions
        : await getUserPermissionsService(user.id, user.tenant_id).catch(() => []);

    const hasViewAllPermission = permissionCodes.includes("sales.view_all");

    canViewAll = hasViewAllPermission
        ? true
        : false;

    if (!canViewAll) {
        conditions.push(`sales.creator_id = $${paramIndex}`);
        params.push(user.id);
        paramIndex++;
    } else if (requestQuery.soldBy) {
        // Only allow filtering by another attendant when viewing all.
        conditions.push(`sales.creator_id = $${paramIndex}`);
        params.push(requestQuery.soldBy);
        paramIndex++;
    }

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`sales.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const paymentStatus = requestQuery?.payment_status ?? requestQuery?.paymentStatus;
    if (paymentStatus !== undefined && paymentStatus !== null && paymentStatus !== "") {
        const ps = parseInt(paymentStatus, 10);
        if (!Number.isNaN(ps)) {
            conditions.push(`sales.payment_status = $${paramIndex}`);
            params.push(ps);
            paramIndex++;
        }
    }

    const where = conditions.join(" AND ");
    const selectSql = `
        SELECT
            sales.id,
            sales.number_of_items,
            sales.total_amount,
            sales.discount_amount,
            sales.invoice_number,
            sales.current_status,
            sales.notes,
            sales.sale_date,
            sales.created_at,
            customers.name AS customer,
            customers.email AS customer_email,
            users.first_name AS attendant_first_name,
            users.last_name AS attendant_last_name
        FROM sales
        LEFT JOIN customers ON sales.customer_id = customers.id
        LEFT JOIN users ON sales.creator_id = users.id
        WHERE ${where}
        ORDER BY sales.created_at DESC
    `;

    const limitRaw = requestQuery.limit ?? requestQuery.pageSize;
    const hasLimit = limitRaw !== undefined && limitRaw !== null && String(limitRaw).trim() !== '';
    if (!hasLimit) {
        const result = await pool.query(selectSql, params);
        return result.rows;
    }

    let limit = parseInt(limitRaw, 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 20;
    if (limit > 100) limit = 100;

    let offset = parseInt(requestQuery.offset ?? requestQuery.skip ?? 0, 10);
    if (Number.isNaN(offset) || offset < 0) offset = 0;

    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM sales WHERE ${where}`,
        params
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const pageParams = [...params, limit, offset];
    const pageResult = await pool.query(
        `${selectSql} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        pageParams
    );

    return {
        items: pageResult.rows,
        total,
        limit,
        offset,
    };
};

/**
 * Sales list for a given date (single day).
 * Query: date=YYYY-MM-DD (required)
 * Respects tenant_id and user_type (non-admin sees only own sales).
 */
export const getSalesByDateService = async (user, requestQuery = {}) => {
    const date = requestQuery.date || requestQuery.day;
    if (!date) {
        throw new Error("date is required (YYYY-MM-DD).");
    }

    const conditions = ["sales.tenant_id = $1", "sales.created_at::date = $2::date"];
    const params = [user.tenant_id, date];
    let paramIndex = 3;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        conditions.push(`sales.creator_id = $${paramIndex}`);
        params.push(user.id);
        paramIndex++;
    }

    if (requestQuery.soldBy && canViewAll) {
        conditions.push(`sales.creator_id = $${paramIndex}`);
        params.push(requestQuery.soldBy);
        paramIndex++;
    }

    const paymentStatus = requestQuery?.payment_status ?? requestQuery?.paymentStatus;
    if (paymentStatus !== undefined && paymentStatus !== null && paymentStatus !== "") {
        const ps = parseInt(paymentStatus, 10);
        if (!Number.isNaN(ps)) {
            conditions.push(`sales.payment_status = $${paramIndex}`);
            params.push(ps);
            paramIndex++;
        }
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT
            sales.id,
            sales.number_of_items,
            sales.total_amount,
            sales.discount_amount,
            sales.invoice_number,
            sales.current_status,
            sales.notes,
            sales.sale_date,
            sales.created_at,
            customers.name AS customer,
            customers.email AS customer_email,
            users.first_name AS attendant_first_name,
            users.last_name AS attendant_last_name
        FROM sales
        LEFT JOIN customers ON sales.customer_id = customers.id
        LEFT JOIN users ON sales.creator_id = users.id
        WHERE ${where}
        ORDER BY sales.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * Top 5 selling products by total revenue (units sold + revenue per product).
 * Respects tenant_id and user_type (non-admin sees only own sales).
 * Optional query: startDate, endDate to restrict date range.
 */
export const getTopSellingProductsService = async (user, requestQuery = {}) => {
    const { tenant_id, id: userId } = user;
    const conditions = ["sd.tenant_id = $1"];
    const params = [tenant_id];
    let paramIndex = 2;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        conditions.push(`s.creator_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`s.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const limitRaw = parseInt(requestQuery.limit ?? "5", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 5;
    params.push(limit);

    const where = conditions.join(" AND ");
    const query = `
        SELECT
            p.id AS product_id,
            p.name AS product_name,
            p.sku,
            COALESCE(SUM(sd.quantity), 0)::int AS units_sold,
            COALESCE(SUM(sd.quantity * sd.unit_price), 0)::numeric AS total_revenue
        FROM saledetails sd
        JOIN sales s ON sd.sale_id = s.id AND s.tenant_id = sd.tenant_id
        LEFT JOIN products p ON sd.product_id = p.id
        WHERE ${where}
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_revenue DESC NULLS LAST
        LIMIT $${paramIndex}
    `;
    const result = await pool.query(query, params);
    return (result.rows || []).map((row) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        sku: row.sku,
        units_sold: Number(row.units_sold || 0),
        total_revenue: Number(row.total_revenue || 0),
    }));
};

/**
 * Payment-method split for a date range (Cash / Mobile Money / Card / Other).
 * `payment_type`: 1 = cash, 2 = momo (web). Mobile often only records method in notes.
 */
export const getSalesPaymentMethodBreakdownService = async (user, requestQuery = {}) => {
    const { tenant_id, id: userId } = user;
    const conditions = ["s.tenant_id = $1"];
    const params = [tenant_id];
    let paramIndex = 2;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        conditions.push(`s.creator_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`s.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT
            CASE
                WHEN s.payment_type = 2 THEN 'Mobile Money'
                WHEN s.payment_type = 3 THEN 'Card'
                WHEN s.payment_type = 1 THEN 'Cash'
                WHEN lower(coalesce(s.notes, '')) LIKE '%paid with momo%'
                  OR lower(coalesce(s.notes, '')) LIKE '%mobile money%' THEN 'Mobile Money'
                WHEN lower(coalesce(s.notes, '')) LIKE '%paid with card%'
                  OR lower(coalesce(s.notes, '')) LIKE '% card%' THEN 'Card'
                WHEN lower(coalesce(s.notes, '')) LIKE '%paid with cash%' THEN 'Cash'
                ELSE 'Unspecified'
            END AS method,
            COUNT(s.id)::int AS transaction_count,
            COALESCE(SUM(s.total_amount), 0)::numeric AS total_amount
        FROM sales s
        WHERE ${where}
        GROUP BY 1
        ORDER BY total_amount DESC, method ASC
    `;
    const result = await pool.query(query, params);
    return (result.rows || []).map((row) => ({
        method: row.method,
        transactionCount: Number(row.transaction_count || 0),
        totalAmount: Number(row.total_amount || 0),
    }));
};

/**
 * Sales summary for a tenant (respects user_type like dashboard).
 * Returns:
 *  - overall: { totalSales, transactionCount, averagePerSale }
 *  - thisWeek, lastWeek, thisMonth: same shape
 *  - range (if startDate & endDate provided): same shape
 */
export const getSalesSummaryService = async (user, requestQuery = {}) => {
    // console.log('getSalesSummaryService requestQuery',requestQuery);
    const { tenant_id, id: userId } = user;
    const hasCustomRange = requestQuery.startDate && requestQuery.endDate;

    const baseWhere = ["s.tenant_id = $1"];
    const params = [tenant_id];
    let paramIndex = 2;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        baseWhere.push(`s.creator_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }

    const whereOverall = baseWhere.join(" AND ");

    const summaryFragment = `
        COUNT(*)::int AS transaction_count,
        COALESCE(SUM(s.total_amount), 0)::numeric AS total_sales,
        CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(s.total_amount), 0) / COUNT(*) ELSE 0 END::numeric AS average_per_sale
    `;

    // Overall (optionally filtered by custom date range)
    const overallConditions = [...baseWhere];
    const overallParams = [...params];
    let overallWhere = whereOverall;
    if (hasCustomRange) {
        overallConditions.push(`s.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        overallParams.push(requestQuery.startDate, requestQuery.endDate);
        overallWhere = overallConditions.join(" AND ");
    }
    const overallQuery = `
        SELECT ${summaryFragment}
        FROM sales s
        WHERE ${overallWhere}
    `;
    const overallResult = await pool.query(overallQuery, overallParams);
    const overall = overallResult.rows[0] || { transaction_count: 0, total_sales: 0, average_per_sale: 0 };

    // Helper to query a time window (ignores custom range)
    const windowSummary = async (fromExpr, toExpr) => {
        const windowWhereParts = [...baseWhere];
        const windowParams = [...params];
        let idx = paramIndex;
        if (fromExpr) {
            windowWhereParts.push(`s.created_at >= ${fromExpr}`);
        }
        if (toExpr) {
            windowWhereParts.push(`s.created_at < ${toExpr}`);
        }
        const windowWhere = windowWhereParts.join(" AND ");
        const q = `
            SELECT ${summaryFragment}
            FROM sales s
            WHERE ${windowWhere}
        `;
        const r = await pool.query(q, windowParams);
        return r.rows[0] || { transaction_count: 0, total_sales: 0, average_per_sale: 0 };
    };

    // This week: from Monday of current week
    const thisWeek = await windowSummary(
        "date_trunc('week', CURRENT_DATE)",
        null
    );

    // Last week: previous week window
    const lastWeek = await windowSummary(
        "date_trunc('week', CURRENT_DATE) - interval '7 days'",
        "date_trunc('week', CURRENT_DATE)"
    );

    // This month
    const thisMonth = await windowSummary(
        "date_trunc('month', CURRENT_DATE)",
        null
    );

    // Last month
    const lastMonth = await windowSummary(
        "date_trunc('month', CURRENT_DATE) - interval '1 month'",
        "date_trunc('month', CURRENT_DATE)"
    );

    // Custom range summary (if provided)
    let range = null;
    if (hasCustomRange) {
        const rangeConditions = [...baseWhere, `s.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`];
        const rangeParams = [...params, requestQuery.startDate, requestQuery.endDate];
        const rangeQuery = `
            SELECT ${summaryFragment}
            FROM sales s
            WHERE ${rangeConditions.join(" AND ")}
        `;
        const rangeResult = await pool.query(rangeQuery, rangeParams);
        const r = rangeResult.rows[0] || { transaction_count: 0, total_sales: 0, average_per_sale: 0 };
        range = {
            totalSales: Number(r.total_sales || 0),
            transactionCount: Number(r.transaction_count || 0),
            averagePerSale: Number(r.average_per_sale || 0),
        };
    }

    const mapRow = (row) => ({
        totalSales: Number(row.total_sales || 0),
        transactionCount: Number(row.transaction_count || 0),
        averagePerSale: Number(row.average_per_sale || 0),
    });

    return {
        overall: mapRow(overall),
        thisWeek: mapRow(thisWeek),
        lastWeek: mapRow(lastWeek),
        thisMonth: mapRow(thisMonth),
        lastMonth: mapRow(lastMonth),
        range,
    };
};

/**
 * Revenue report for a tenant, grouped by day over a date range.
 * Defaults to last 30 days if no startDate/endDate provided.
 * Respects user_type: non-admin (user_type != 1) only sees own sales.
 */
export const getRevenueReportService = async (user, requestQuery = {}) => {
    const { tenant_id, id: userId } = user;

    const defaultEnd = new Date();
    const defaultStart = new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate =
        requestQuery.startDate ||
        requestQuery.from ||
        defaultStart.toISOString().slice(0, 10);
    const endDate =
        requestQuery.endDate ||
        requestQuery.to ||
        defaultEnd.toISOString().slice(0, 10);

    const conditions = ["s.tenant_id = $1", "s.created_at BETWEEN $2 AND $3"];
    const params = [tenant_id, startDate, endDate];
    let paramIndex = 4;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        conditions.push(`s.creator_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT
            DATE(s.created_at) AS date,
            COALESCE(SUM(s.total_amount), 0)::numeric AS total,
            COUNT(s.id)::int AS count
        FROM sales s
        WHERE ${where}
        GROUP BY DATE(s.created_at)
        ORDER BY DATE(s.created_at)
    `;
    const result = await pool.query(query, params);

    const daily = result.rows.map((row) => ({
        date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
        total: Number(row.total || 0),
        count: Number(row.count || 0),
    }));

    const totalRevenue = daily.reduce((acc, r) => acc + r.total, 0);
    const transactionCount = daily.reduce((acc, r) => acc + r.count, 0);
    const averagePerSale = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    return {
        startDate,
        endDate,
        totalRevenue,
        transactionCount,
        averagePerSale,
        daily,
    };
};

/**
 * Daily sales summary for a tenant, grouped by day over a date range.
 * Same filters/behavior as revenue report, but returns sales-focused fields.
 * Defaults to last 30 days if no startDate/endDate provided.
 */
export const getDailySalesSummaryService = async (user, requestQuery = {}) => {
    const revenue = await getRevenueReportService(user, requestQuery);
    const daily = (revenue.daily || []).map((d) => ({
        date: d.date,
        totalSales: Number(d.total || 0),
        transactionCount: Number(d.count || 0),
        averagePerSale: Number(d.count || 0) > 0 ? Number(d.total || 0) / Number(d.count || 0) : 0,
    }));

    return {
        startDate: revenue.startDate,
        endDate: revenue.endDate,
        totalSales: Number(revenue.totalRevenue || 0),
        transactionCount: Number(revenue.transactionCount || 0),
        averagePerSale: Number(revenue.averagePerSale || 0),
        daily,
    };
};

/**
 * Sales by customers summary: total sales and orders count per customer.
 * Defaults to last 30 days if no date range is provided.
 * Respects user_type: non-admin (user_type != 1) only sees own sales.
 */
export const getSalesByCustomerSummaryService = async (user, requestQuery = {}) => {
    const { tenant_id, id: userId } = user;

    const defaultEnd = new Date();
    const defaultStart = new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate =
        requestQuery.startDate ||
        requestQuery.from ||
        defaultStart.toISOString().slice(0, 10);
    const endDate =
        requestQuery.endDate ||
        requestQuery.to ||
        defaultEnd.toISOString().slice(0, 10);

    const conditions = ["s.tenant_id = $1", "s.created_at BETWEEN $2 AND $3"];
    const params = [tenant_id, startDate, endDate];
    let paramIndex = 4;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        conditions.push(`s.creator_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT
            s.customer_id,
            c.name AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            COUNT(s.id)::int AS orders_count,
            COALESCE(SUM(s.total_amount), 0)::numeric AS total_sales
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE ${where}
        GROUP BY s.customer_id, c.name, c.email, c.phone
        ORDER BY total_sales DESC, orders_count DESC, customer_name ASC
    `;
    const result = await pool.query(query, params);
    return {
        startDate,
        endDate,
        customers: result.rows.map((row) => ({
            customer_id: row.customer_id,
            customer_name: row.customer_name,
            customer_email: row.customer_email,
            customer_phone: row.customer_phone,
            ordersCount: Number(row.orders_count || 0),
            totalSales: Number(row.total_sales || 0),
        })),
    };
};

/**
 * Sales by customers report:
 *  - totalCustomers: number of distinct customers in the period
 *  - totalSales: overall sum of sales in the period
 *  - customers: list with per-customer totals and sales count
 * Date range and user_type handling same as getSalesByCustomerSummaryService.
 */
export const getSalesByCustomersReportService = async (user, requestQuery = {}) => {
    const { tenant_id, id: userId } = user;

    const defaultEnd = new Date();
    const defaultStart = new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate =
        requestQuery.startDate ||
        requestQuery.from ||
        defaultStart.toISOString().slice(0, 10);
    const endDate =
        requestQuery.endDate ||
        requestQuery.to ||
        defaultEnd.toISOString().slice(0, 10);

    const conditions = ["s.tenant_id = $1", "s.created_at BETWEEN $2 AND $3"];
    const params = [tenant_id, startDate, endDate];
    let paramIndex = 4;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        conditions.push(`s.creator_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT
            s.customer_id,
            c.name AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            COUNT(s.id)::int AS orders_count,
            COALESCE(SUM(s.total_amount), 0)::numeric AS total_sales
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE ${where}
        GROUP BY s.customer_id, c.name, c.email, c.phone
        ORDER BY total_sales DESC, orders_count DESC, customer_name ASC
    `;
    const result = await pool.query(query, params);

    const customers = result.rows.map((row) => ({
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        customer_phone: row.customer_phone,
        ordersCount: Number(row.orders_count || 0),
        totalSales: Number(row.total_sales || 0),
    }));

    const totalCustomers = customers.length;
    const totalSales = customers.reduce(
        (sum, c) => sum + Number(c.totalSales || 0),
        0
    );

    return {
        startDate,
        endDate,
        totalCustomers,
        totalSales,
        customers,
    };
};

/**
 * Sales by user (creator/attendant) summary:
 *  - per user: total sales amount and transactions count
 *  - respects tenant_id and user_type (non-admin sees only own sales)
 *  - date range: startDate/endDate (or from/to), defaults to last 30 days
 */
export const getSalesByUserSummaryService = async (user, requestQuery = {}) => {
    const { tenant_id, id: userId } = user;

    const defaultEnd = new Date();
    const defaultStart = new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate =
        requestQuery.startDate ||
        requestQuery.from ||
        defaultStart.toISOString().slice(0, 10);
    const endDate =
        requestQuery.endDate ||
        requestQuery.to ||
        defaultEnd.toISOString().slice(0, 10);

    const conditions = ["s.tenant_id = $1", "s.created_at BETWEEN $2 AND $3"];
    const params = [tenant_id, startDate, endDate];
    let paramIndex = 4;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        conditions.push(`s.creator_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT
            s.creator_id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            COUNT(s.id)::int AS transactions_count,
            COALESCE(SUM(s.total_amount), 0)::numeric AS total_sales
        FROM sales s
        LEFT JOIN users u ON s.creator_id = u.id
        WHERE ${where}
        GROUP BY s.creator_id, u.first_name, u.last_name, u.email, u.phone
        ORDER BY total_sales DESC, transactions_count DESC, u.first_name ASC, u.last_name ASC
    `;
    const result = await pool.query(query, params);

    return {
        startDate,
        endDate,
        users: (result.rows || []).map((row) => ({
            user_id: row.creator_id,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            phone: row.phone,
            transactionsCount: Number(row.transactions_count || 0),
            totalSales: Number(row.total_sales || 0),
        })),
    };
};

/**
 * Logged-in user's Month-To-Date (MTD) sales total.
 * Always filtered to the current user (creator_id), regardless of permissions.
 */
/**
 * Gross profit totals (all-time and current month) from sale lines.
 */
export const getGrossProfitTotalsService = async (user) => {
    const { tenant_id, id: userId } = user;
    const canViewAll = await canViewAllSalesForUser(user);
    const conditions = ["s.tenant_id = $1"];
    const params = [tenant_id];
    if (!canViewAll) {
        conditions.push("s.creator_id = $2");
        params.push(userId);
    }
    const salesWhere = conditions.join(" AND ");

    const result = await pool.query(
        `
        SELECT
            COALESCE(SUM(sd.quantity * sd.unit_price), 0)::numeric AS revenue,
            COALESCE(SUM(sd.quantity * COALESCE(sd.unit_cost, purch.avg_cost, p.actual_cost, 0)), 0)::numeric AS cogs,
            COALESCE(SUM(sd.quantity * sd.unit_price) FILTER (
                WHERE s.created_at >= date_trunc('month', CURRENT_DATE)
            ), 0)::numeric AS month_revenue,
            COALESCE(SUM(sd.quantity * COALESCE(sd.unit_cost, purch.avg_cost, p.actual_cost, 0)) FILTER (
                WHERE s.created_at >= date_trunc('month', CURRENT_DATE)
            ), 0)::numeric AS month_cogs
        FROM saledetails sd
        JOIN sales s ON sd.sale_id = s.id
        JOIN products p ON p.id = sd.product_id AND p.tenant_id = s.tenant_id
        LEFT JOIN LATERAL (
            SELECT CASE
                WHEN SUM(pd.quantity) > 0
                THEN (SUM(pd.quantity * pd.unit_price) / SUM(pd.quantity))::numeric
                ELSE NULL
            END AS avg_cost
            FROM purchasedetails pd
            WHERE pd.tenant_id = sd.tenant_id AND pd.product_id = sd.product_id
        ) purch ON true
        WHERE ${salesWhere}
        `,
        params
    );
    const row = result.rows[0] || {};
    const revenue = Number(row.revenue || 0);
    const cogs = Number(row.cogs || 0);
    const monthRevenue = Number(row.month_revenue || 0);
    const monthCogs = Number(row.month_cogs || 0);
    return {
        revenue,
        grossProfit: revenue - cogs,
        monthRevenue,
        monthGrossProfit: monthRevenue - monthCogs,
    };
};

export const getMyMtdSalesTotalService = async (user) => {
    const result = await pool.query(
        `
        SELECT
            COALESCE(SUM(s.total_amount), 0)::numeric AS total_sales,
            COUNT(s.id)::int AS transactions_count
        FROM sales s
        WHERE s.tenant_id = $1
          AND s.creator_id = $2
          AND s.created_at >= date_trunc('month', CURRENT_DATE)
        `,
        [user.tenant_id, user.id]
    );

    const row = result.rows[0] || { total_sales: 0, transactions_count: 0 };
    return {
        period: "mtd",
        totalSales: Number(row.total_sales || 0),
        transactionsCount: Number(row.transactions_count || 0),
    };
};

/**
 * Resolve per-unit cost: weighted avg purchase price (if any), else products.actual_cost.
 */
export async function resolveProductUnitCost(client, { productId, tenantId, warehouseId, asOfDate }) {
    const asOf = asOfDate || new Date();
    const params = [tenantId, productId, asOf];
    let warehouseSql = "";
    if (warehouseId) {
        warehouseSql = " AND pd.warehouse_id = $4";
        params.push(warehouseId);
    }
    const purch = await client.query(
        `SELECT CASE
            WHEN SUM(pd.quantity) > 0
            THEN (SUM(pd.quantity * pd.unit_price) / SUM(pd.quantity))::numeric
            ELSE NULL
         END AS avg_cost
         FROM purchasedetails pd
         WHERE pd.tenant_id = $1 AND pd.product_id = $2 AND pd.created_at <= $3${warehouseSql}`,
        params
    );
    const prod = await client.query(
        `SELECT actual_cost FROM products WHERE id = $1 AND tenant_id = $2`,
        [productId, tenantId]
    );
    const avg = purch.rows[0]?.avg_cost;
    if (avg != null && Number(avg) > 0) return Number(avg);
    const actual = prod.rows[0]?.actual_cost;
    if (actual != null && Number.isFinite(Number(actual))) return Math.max(0, Number(actual));
    return 0;
}

/**
 * COGS report for a tenant over a date range.
 * Defaults to last 30 days if no date range is provided.
 * Cost basis: saledetails.unit_cost snapshot, else purchase weighted avg, else products.actual_cost.
 * Respects user_type for revenue (non-admin sees only own sales).
 */
export const getCogsReportService = async (user, requestQuery = {}) => {
    const { tenant_id, id: userId } = user;

    const defaultEnd = new Date();
    const defaultStart = new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate =
        requestQuery.startDate ||
        requestQuery.from ||
        defaultStart.toISOString().slice(0, 10);
    const endDate =
        requestQuery.endDate ||
        requestQuery.to ||
        defaultEnd.toISOString().slice(0, 10);

    const baseSalesConditions = ["s.tenant_id = $1", "s.created_at BETWEEN $2 AND $3"];
    const salesParams = [tenant_id, startDate, endDate];
    let paramIndex = 4;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        baseSalesConditions.push(`s.creator_id = $${paramIndex}`);
        salesParams.push(userId);
        paramIndex++;
    }

    const productId = requestQuery.productId || requestQuery.product_id;
    if (productId) {
        baseSalesConditions.push(`sd.product_id = $${paramIndex}`);
        salesParams.push(productId);
        paramIndex++;
    }

    const warehouseId = requestQuery.warehouseId || requestQuery.warehouse_id;
    if (warehouseId) {
        baseSalesConditions.push(`sd.warehouse_id = $${paramIndex}`);
        salesParams.push(warehouseId);
        paramIndex++;
    }

    const supplierId = requestQuery.supplierId || requestQuery.supplier_id;
    if (supplierId) {
        baseSalesConditions.push(`sd.supplier_id = $${paramIndex}`);
        salesParams.push(supplierId);
        paramIndex++;
    }

    const customerId = requestQuery.customerId || requestQuery.customer_id;
    if (customerId) {
        baseSalesConditions.push(`s.customer_id = $${paramIndex}`);
        salesParams.push(customerId);
        paramIndex++;
    }

    const salesWhere = baseSalesConditions.join(" AND ");

    const query = `
        WITH sales_lines AS (
            SELECT
                sd.product_id,
                sd.quantity,
                sd.unit_price,
                COALESCE(
                    sd.unit_cost,
                    purch.avg_cost,
                    p.actual_cost,
                    0
                )::numeric AS line_unit_cost
            FROM saledetails sd
            JOIN sales s ON sd.sale_id = s.id
            JOIN products p ON p.id = sd.product_id AND p.tenant_id = s.tenant_id
            LEFT JOIN LATERAL (
                SELECT CASE
                    WHEN SUM(pd.quantity) > 0
                    THEN (SUM(pd.quantity * pd.unit_price) / SUM(pd.quantity))::numeric
                    ELSE NULL
                END AS avg_cost
                FROM purchasedetails pd
                WHERE pd.tenant_id = sd.tenant_id
                  AND pd.product_id = sd.product_id
                  AND pd.created_at <= $3::timestamp
            ) purch ON true
            WHERE ${salesWhere}
        ),
        sales_agg AS (
            SELECT
                product_id,
                COALESCE(SUM(quantity), 0)::numeric AS sold_qty,
                COALESCE(SUM(quantity * unit_price), 0)::numeric AS revenue,
                COALESCE(SUM(quantity * line_unit_cost), 0)::numeric AS cogs
            FROM sales_lines
            GROUP BY product_id
        )
        SELECT
            sa.product_id,
            p.name AS product_name,
            p.sku,
            sa.sold_qty::int AS sold_qty,
            sa.revenue,
            CASE WHEN sa.sold_qty > 0 THEN (sa.cogs / sa.sold_qty)::numeric ELSE 0::numeric END AS avg_cost,
            sa.cogs,
            (sa.revenue - sa.cogs)::numeric AS gross_margin
        FROM sales_agg sa
        JOIN products p ON p.id = sa.product_id AND p.tenant_id = $1
        ORDER BY sa.revenue DESC, sa.sold_qty DESC, p.name ASC
    `;

    const result = await pool.query(query, salesParams);
    const items = result.rows.map((row) => {
        const revenue = Number(row.revenue || 0);
        const cogs = Number(row.cogs || 0);
        const grossMargin = Number(row.gross_margin || 0);
        const soldQty = Number(row.sold_qty || 0);
        const grossMarginPercent = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
        return {
            product_id: row.product_id,
            product_name: row.product_name,
            sku: row.sku,
            soldQty,
            revenue,
            avgCost: Number(row.avg_cost || 0),
            cogs,
            grossMargin,
            grossMarginPercent,
        };
    });

    const totals = items.reduce(
        (acc, item) => {
            acc.revenue += item.revenue;
            acc.cogs += item.cogs;
            acc.grossMargin += item.grossMargin;
            acc.soldQty += item.soldQty;
            return acc;
        },
        { revenue: 0, cogs: 0, grossMargin: 0, soldQty: 0 }
    );
    const grossMarginPercentTotal =
        totals.revenue > 0 ? (totals.grossMargin / totals.revenue) * 100 : 0;

    return {
        startDate,
        endDate,
        totalRevenue: totals.revenue,
        totalCogs: totals.cogs,
        totalGrossMargin: totals.grossMargin,
        totalSoldQty: totals.soldQty,
        totalGrossMarginPercent: grossMarginPercentTotal,
        items,
    };
};

export const getSalesByCustomerIdService = async (user, customer_id, requestQuery = {}) => {
    const conditions = ["sales.tenant_id = $1", "sales.customer_id = $2"];
    const params = [user.tenant_id, customer_id];
    let paramIndex = 3;

    const canViewAll = await canViewAllSalesForUser(user);
    if (!canViewAll) {
        conditions.push("sales.creator_id = $" + paramIndex);
        params.push(user.id);
        paramIndex += 1;
    }

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push("sales.created_at BETWEEN $" + paramIndex + " AND $" + (paramIndex + 1));
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const where = conditions.join(" AND ");
    const query = `SELECT sales.id, sales.number_of_items, sales.total_amount, sales.discount_amount, sales.invoice_number, sales.current_status, sales.sale_date, sales.created_at, users.first_name AS attendant_first_name, users.last_name AS attendant_last_name
        FROM sales
        LEFT JOIN users ON sales.creator_id = users.id
        WHERE ${where}
        ORDER BY sales.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
};

const SALE_BY_ID_SELECT = `
            sales.id,
            sales.tenant_id,
            sales.warehouse_id,
            sales.number_of_items,
            sales.total_amount,
            sales.discount_amount,
            sales.invoice_number,
            sales.created_at,
            sales.sale_date,
            sales.current_status,
            sales.notes,
            sales.payment_type,
            sales.payment_reference,
            sales.payment_date,
            sales.payment_number,
            sales.payment_status,
            customers.name AS customer,
            customers.phone AS customer_phone,
            customers.email AS customer_email,
            customers.address AS customer_address,
            u.first_name AS attendant_first_name,
            u.last_name AS attendant_last_name,
            warehouses.name AS warehouse_name`;

async function attachSaleProducts(saleRow, saleId) {
    if (!saleRow) return null;
    const x = await pool.query(
        `SELECT sd.id, sd.quantity, sd.unit_price, sd.created_at, products.id, products.name, products.sku, products.thumbnail
         FROM saledetails sd
         LEFT JOIN products ON sd.product_id = products.id
         WHERE sd.sale_id = $1`,
        [saleId],
    );
    saleRow.products = x.rows || [];
    return saleRow;
}

export const getSaleByIdService = async (id) => {
    const result = await pool.query(
        `SELECT ${SALE_BY_ID_SELECT}
         FROM sales
         LEFT JOIN customers ON sales.customer_id = customers.id
         LEFT JOIN users u ON sales.creator_id = u.id
         LEFT JOIN warehouses ON sales.warehouse_id = warehouses.id
         WHERE sales.id = $1`,
        [id],
    );
    return attachSaleProducts(result.rows[0], id);
};

export const getSaleByIdForTenantService = async (id, tenant_id) => {
    const result = await pool.query(
        `SELECT ${SALE_BY_ID_SELECT}
         FROM sales
         LEFT JOIN customers ON sales.customer_id = customers.id
         LEFT JOIN users u ON sales.creator_id = u.id
         LEFT JOIN warehouses ON sales.warehouse_id = warehouses.id
         WHERE sales.id = $1 AND sales.tenant_id = $2`,
        [id, tenant_id],
    );
    return attachSaleProducts(result.rows[0], id);
};

async function loadTenantForInvoice(tenant_id) {
    const result = await pool.query(
        `SELECT id, name, organization, phone, email, address, city, state, country FROM tenants WHERE id = $1`,
        [tenant_id],
    );
    return result.rows[0] || {};
}

export const buildSaleInvoicePackageService = async (saleId, tenant_id) => {
    const sale = await getSaleByIdForTenantService(saleId, tenant_id);
    if (!sale) {
        const err = new Error('Sale not found.');
        err.statusCode = 404;
        throw err;
    }
    const tenant = await loadTenantForInvoice(tenant_id);
    const { buildInvoiceFromSaleRow, buildSaleInvoicePdfBuffer, formatInvoicePlainText, invoicePdfFilename } =
        await import('../utils/saleInvoice.js');
    const invoice = buildInvoiceFromSaleRow(sale, tenant, sale.warehouse_name);
    const pdfBuffer = await buildSaleInvoicePdfBuffer(invoice);
    const filename = invoicePdfFilename(invoice.invoice_number);
    return {
        invoice,
        pdfBuffer,
        filename,
        plainText: formatInvoicePlainText(invoice),
    };
};

export const sendSaleInvoiceEmailService = async (saleId, tenant_id, { email } = {}) => {
    const pkg = await buildSaleInvoicePackageService(saleId, tenant_id);
    const to = String(email || pkg.invoice.customer_email || '').trim();
    if (!to) {
        const err = new Error('Customer email is required. Add an email on the customer or pass email in the request body.');
        err.statusCode = 400;
        throw err;
    }
    const tenant = await loadTenantForInvoice(tenant_id);
    const companyName = tenant.name || tenant.organization || 'Shopynn';
    await sendEmailService({
        sender_name: companyName,
        receipient: to,
        subject: `Invoice ${pkg.invoice.invoice_number}`,
        title: `Invoice from ${companyName}`,
        message: `Please find your invoice ${pkg.invoice.invoice_number} attached.`,
        text: pkg.plainText,
        html: `<p>Hello ${pkg.invoice.customer_name},</p><p>Please find invoice <strong>${pkg.invoice.invoice_number}</strong> attached.</p><pre style="white-space:pre-wrap;font-family:monospace;font-size:12px">${pkg.plainText.replace(/</g, '&lt;')}</pre>`,
        attachments: [
            {
                filename: pkg.filename,
                content: pkg.pdfBuffer,
                contentType: 'application/pdf',
            },
        ],
    });
    return { sent_to: to, invoice_number: pkg.invoice.invoice_number };
};

/** Permissions that may receive minimum-stock emails (assign to admin / ops roles). */
const LOW_STOCK_ALERT_PERMISSION_CODES = ["inventory.low_stock.alerts", "inventory.low_stock.view"];

/**
 * Stored preferences JSON (partial ok). Aligns with userPreferences defaults + notifications_setup (lowStock).
 */
const userWantsLowStockEmail = (storedPreferences) => {
    const n = storedPreferences?.notifications;
    if (n?.email === false) return false;
    const types = n?.types;
    if (types == null) return true;
    if (Array.isArray(types)) {
        return types.includes("lowStock") || types.includes("low_stock");
    }
    if (typeof types === "object") {
        return types.lowStock !== false;
    }
    return true;
};

const resolveLowStockAlertRecipients = async (tenant_id) => {
    const candidates = await getUsersWithPermissionCodesForTenant(tenant_id, LOW_STOCK_ALERT_PERMISSION_CODES);
    if (!candidates.length) return [];

    const ids = candidates.map((c) => c.id);
    const prefRes = await pool.query(
        `SELECT user_id, preferences FROM user_preferences WHERE user_id = ANY($1::text[])`,
        [ids]
    );
    const prefByUser = new Map(prefRes.rows.map((r) => [r.user_id, r.preferences]));

    const emails = new Set();
    for (const row of candidates) {
        const stored = prefByUser.get(row.id);
        if (!userWantsLowStockEmail(stored)) continue;
        const e = String(row.email || "").trim().toLowerCase();
        if (e) emails.add(e);
    }
    return [...emails];
};

const sendStockLevelAlert = async (tenant_id, prod) => {
    const { newQuantity, name, minimum_stock_level: minStock } = prod;
    const productName = (name && String(name).trim()) || "Unknown product";
    const qty = Number(newQuantity);
    const minLevel = minStock != null && minStock !== "" ? Number(minStock) : null;

    const recipients = await resolveLowStockAlertRecipients(tenant_id);
    if (recipients.length === 0) {
        console.warn(
            "Low stock alert: no recipients (grant inventory.low_stock.alerts or inventory.low_stock.view, and ensure email + notification preferences allow low-stock)."
        );
        return;
    }

    const subject = `Shopynn alert - Low stock for ${productName}`;
    const title = "Low stock notification";
    const parts = [
        "This is an automated inventory alert from Shopynn.",
        `<strong>Product:</strong> ${productName}`,
        `<strong>Quantity on hand after this sale:</strong> ${Number.isFinite(qty) ? qty : newQuantity}`,
    ];
    if (minLevel != null && Number.isFinite(minLevel)) {
        parts.push(`<strong>Configured minimum stock level:</strong> ${minLevel}`);
    }
    parts.push(
        "",
        "Current stock is at or below the configured threshold.",
        "Please review this item and raise a replenishment order if required."
    );
    const message = parts.join("<br/>");

    const [primary, ...bccList] = recipients;
    const data = {
        sender_name: "Shopynn Support",
        receipient: primary,
        bcc: bccList.length > 0 ? bccList.join(", ") : undefined,
        subject,
        title,
        message,
    };

    const resp = await sendEmailService(data);
    console.log("email response", resp);
};

export const createSaleService = async (payload) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        // console.log('pl is',payload);
        
        const { discount_amount, tenant_id, invoice_number, current_status, customer_id, warehouse_id, products, notes, created_at, creator_id, payment_type, payment_method, payment_number, payment_reference, payment_status, payment_date } = payload;

        if(!products) {
            throw new Error("Products list cannot be empty.");
        }

        const id = uuidv4();
        const number_of_items = products.reduce((accumulator, currentItem) => accumulator + Number(currentItem.quantity), 0);
        const total_amount = products.reduce((accumulator, currentItem) => accumulator + Number(currentItem.quantity) * Number(currentItem.unit_price), 0);

        let resolvedPaymentType = payment_type;
        if (resolvedPaymentType == null && payment_method) {
            const m = String(payment_method).toLowerCase();
            if (m === "momo" || m === "mobile_money") resolvedPaymentType = 2;
            else if (m === "card") resolvedPaymentType = 3;
            else if (m === "cash") resolvedPaymentType = 1;
        }
        if (resolvedPaymentType != null) resolvedPaymentType = Number(resolvedPaymentType);

        const result = await client.query(`
            INSERT INTO sales (
                id, number_of_items, total_amount, discount_amount, tenant_id, invoice_number, current_status,
                customer_id, warehouse_id, notes, created_at, creator_id,
                payment_type, payment_number, payment_reference, payment_status, payment_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
            [
                id,
                number_of_items,
                total_amount,
                discount_amount,
                tenant_id,
                invoice_number,
                current_status || 1,
                customer_id,
                warehouse_id,
                notes,
                new Date(),
                creator_id,
                Number.isFinite(resolvedPaymentType) ? resolvedPaymentType : null,
                payment_number || null,
                payment_reference || null,
                payment_status != null ? payment_status : null,
                payment_date || null,
            ]
        );

        for (const prod of products) {
            // console.log('pid',prod.id,'warehouse_id',warehouse_id);
            const r1 = await client.query("SELECT inventories.id, inventories.quantity_available, inventories.minimum_stock_level, products.name FROM inventories LEFT JOIN products ON inventories.product_id = products.id WHERE inventories.product_id = $1 AND inventories.warehouse_id=$2 ORDER BY inventories.created_at DESC", [prod.id, warehouse_id]);
            // console.log('r1.rowCount',r1.rowCount);
            if(r1.rowCount) {
                // console.log('curr. inv r1',r1.rows);
                await client.query("UPDATE inventories SET quantity_available = quantity_available - $1, updated_at=$2 WHERE id=$3 RETURNING id",[prod.quantity, new Date(), r1.rows[0].id]);
                // console.log('AFTER UPDATE');
                
                const minStock = r1.rows[0].minimum_stock_level;
                const qtyAvailable = r1.rows[0].quantity_available;
                // console.log('minStock',minStock,'qtyAvailable',qtyAvailable);
                if(Number(minStock) >= Number(Number(qtyAvailable) - Number(prod.quantity))) {
                    void sendStockLevelAlert(tenant_id, {
                        ...r1.rows[0],
                        newQuantity: Number(qtyAvailable) - Number(prod.quantity),
                    }).catch((err) => console.error("Low stock alert email failed:", err));
                }
                // else console.log('we still have quantity');
            }

            await client.query("UPDATE products SET inventory = inventory - $1, updated_at=$2 WHERE id=$3 RETURNING id",[prod.quantity, created_at, prod.id]);

            const unitCost = await resolveProductUnitCost(client, {
                productId: prod.id,
                tenantId: tenant_id,
                warehouseId: warehouse_id,
                asOfDate: new Date(),
            });
            const _newId = uuidv4();
            await client.query(
                "INSERT INTO saledetails (id, sale_id, product_id, quantity, unit_price, unit_cost, warehouse_id, tenant_id, creator_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",
                [_newId, result.rows[0].id, prod.id, prod.quantity, prod.unit_price, unitCost, warehouse_id, tenant_id, creator_id, new Date()]
            );
        }

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export const updateSaleService = async (payload) => {
    const { id, number_of_items, total_amount, discount_amount } = payload;
    const result = await pool.query(`
        UPDATE sales SET number_of_items=$1, total_amount=$2, discount_amount=$3, updated_at=$4  WHERE id=$5 RETURNING *`,
        [number_of_items, total_amount, discount_amount, new Date(), id]
    );

    return result.rows[0];
}

//to be reviewed
export const deleteSaleService = async (id) => {
    const result = await pool.query(`
        UPDATE sales SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}

export const getAllSaleDetailsService = async () => {
    const result = await pool.query("SELECT * FROM saledetails");
    return result.rows;
}

export const getSaleAttendantsService = async () => {
    const result = await pool.query("SELECT id, first_name, last_name, is_active, email FROM users");
    return result.rows;
}