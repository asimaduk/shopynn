import pool from "../config/db.js";
import { getCogsReportService, getGrossProfitTotalsService } from "./sale.js";
import { getUserPermissionsService } from "./userRole.js";

/**
 * Fetches aggregated dashboard/report data for the tenant.
 * Respects user_type: non-admin (user_type != 1) sees only their own sales.
 */
export const getDashboardDataService = async (user, options = {}) => {
    const { tenant_id, user_type } = user;
    const limit = Math.min(Number(options.recentLimit) || 5, 20);

    let canViewAllSales = false;
    if (user_type === 1) {
        canViewAllSales = true;
    } else {
        const permissionCodes = Array.isArray(user.permissions)
            ? user.permissions
            : await getUserPermissionsService(user.id, tenant_id).catch(() => []);
        canViewAllSales = permissionCodes.includes("sales.view_all");
    }

    const baseSalesWhere = "s.tenant_id = $1";
    const salesParams = [tenant_id];
    if (!canViewAllSales) {
        salesParams.push(user.id);
    }
    const salesCreatorFilter = !canViewAllSales ? " AND s.creator_id = $2" : "";

    // Sales summary: count, total revenue (all time, current month)
    const salesSummaryQuery = `
        SELECT
            COUNT(*)::int AS total_count,
            COALESCE(SUM(s.total_amount), 0)::numeric AS total_revenue,
            COUNT(*) FILTER (WHERE s.created_at >= date_trunc('month', CURRENT_DATE))::int AS month_count,
            COALESCE(SUM(s.total_amount) FILTER (WHERE s.created_at >= date_trunc('month', CURRENT_DATE)), 0)::numeric AS month_revenue
        FROM sales s
        WHERE ${baseSalesWhere}${salesCreatorFilter}
    `;
    const salesSummary = await pool.query(salesSummaryQuery, salesParams);
    const sales = salesSummary.rows[0] || { total_count: 0, total_revenue: 0, month_count: 0, month_revenue: 0 };

    // Sales per day for the last 7 days (all 7 days included, zeros for days with no sales)
    const last7DaysByDayQuery = !canViewAllSales
        ? `WITH last_7_days AS (
             SELECT (CURRENT_DATE - (n || ' days')::interval)::date AS d
             FROM generate_series(6, 0, -1) AS n
           )
           SELECT l.d AS date, COALESCE(SUM(s.total_amount), 0)::numeric AS total, COUNT(s.id)::int AS count
           FROM last_7_days l
           LEFT JOIN sales s ON DATE(s.created_at) = l.d AND s.tenant_id = $1 AND s.creator_id = $2
           GROUP BY l.d ORDER BY l.d`
        : `WITH last_7_days AS (
             SELECT (CURRENT_DATE - (n || ' days')::interval)::date AS d
             FROM generate_series(6, 0, -1) AS n
           )
           SELECT l.d AS date, COALESCE(SUM(s.total_amount), 0)::numeric AS total, COUNT(s.id)::int AS count
           FROM last_7_days l
           LEFT JOIN sales s ON DATE(s.created_at) = l.d AND s.tenant_id = $1
           GROUP BY l.d ORDER BY l.d`;
    const last7DaysParams = !canViewAllSales ? [tenant_id, user.id] : [tenant_id];
    const last7DaysResult = await pool.query(last7DaysByDayQuery, last7DaysParams);
    const last7DaysByDay = last7DaysResult.rows.map((row) => ({
        date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
        count: Number(row.count),
        total: Number(row.total),
    }));

    // Purchases summary (tenant-scoped): all time + current month
    const purchasesSummary = await pool.query(
        `SELECT
            COUNT(*)::int AS total_count,
            COALESCE(SUM(total_amount), 0)::numeric AS total_amount,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS month_count,
            COALESCE(SUM(total_amount) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)), 0)::numeric AS month_amount
        FROM purchases WHERE tenant_id = $1`,
        [tenant_id]
    );
    const purchases = purchasesSummary.rows[0] || { total_count: 0, total_amount: 0, month_count: 0, month_amount: 0 };

    // Expenses summary (tenant-scoped): all time + current month
    const expensesSummary = await pool.query(
        `SELECT
            COUNT(*)::int AS total_count,
            COALESCE(SUM(amount), 0)::numeric AS total_amount,
            COUNT(*) FILTER (WHERE COALESCE(expense_date, created_at) >= date_trunc('month', CURRENT_DATE))::int AS month_count,
            COALESCE(SUM(amount) FILTER (WHERE COALESCE(expense_date, created_at) >= date_trunc('month', CURRENT_DATE)), 0)::numeric AS month_amount
        FROM expenses WHERE tenant_id = $1`,
        [tenant_id]
    );
    const expenses = expensesSummary.rows[0] || { total_count: 0, total_amount: 0, month_count: 0, month_amount: 0 };

    // Inventory-based stats: product SKUs + unit totals from inventories
    const productCountResult = await pool.query(
        `SELECT COUNT(DISTINCT product_id)::int AS count
         FROM inventories
         WHERE tenant_id = $1`,
        [tenant_id]
    );
    const productCount = productCountResult.rows[0]?.count ?? 0;

    // Stock valuation at cost (actual_cost) and at retail (unit_price)
    const stockValuationResult = await pool.query(
        `SELECT
            COALESCE(SUM(inv.quantity_available * COALESCE(p.actual_cost, 0)), 0)::numeric AS total_value_at_cost,
            COALESCE(SUM(inv.quantity_available * COALESCE(p.unit_price, 0)), 0)::numeric AS total_value_at_retail,
            COALESCE(SUM(inv.quantity_available), 0)::int AS inventory_count
         FROM inventories inv
         JOIN products p ON inv.product_id = p.id AND p.tenant_id = inv.tenant_id
         WHERE inv.tenant_id = $1`,
        [tenant_id]
    );
    const valuation = stockValuationResult.rows[0] || {
        total_value_at_cost: 0,
        total_value_at_retail: 0,
        inventory_count: 0,
    };
    const totalValueAtCost = Number(valuation.total_value_at_cost);
    const totalValueAtRetail = Number(valuation.total_value_at_retail);
    const inventoryCount = Number(valuation.inventory_count);
    const averageValuePerProduct = productCount > 0 ? totalValueAtCost / productCount : 0;

    const grossProfitTotals = await getGrossProfitTotalsService(user);
    const totalExpensesAllTime = Number(expenses.total_amount || 0);
    const totalExpensesMonth = Number(expenses.month_amount || 0);

    // Stock status by product count (inventory rows): high (>2x min), near low (min..2x], low (<=min)
    const stockStatusResult = await pool.query(
        `SELECT
            COUNT(*) FILTER (
                WHERE quantity_available > 2 * COALESCE(minimum_stock_level, 0)
            )::int AS high_stock_total,
            COUNT(*) FILTER (
                WHERE quantity_available > COALESCE(minimum_stock_level, 0)
                  AND quantity_available <= 2 * COALESCE(minimum_stock_level, 0)
            )::int AS near_low_total,
            COUNT(*) FILTER (
                WHERE quantity_available <= COALESCE(minimum_stock_level, 0)
            )::int AS low_stock_total,
            COUNT(*)::int AS active_products
         FROM inventories WHERE tenant_id = $1`,
        [tenant_id]
    );
    const status = stockStatusResult.rows[0] || {
        high_stock_total: 0,
        near_low_total: 0,
        low_stock_total: 0,
        active_products: 0,
    };
    const activeProducts = Number(status.active_products) || 0;

    // Low stock: inventory rows where quantity_available <= minimum_stock_level
    const lowStockResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM inventories inv
         JOIN products p ON inv.product_id = p.id AND p.tenant_id = inv.tenant_id
         WHERE inv.tenant_id = $1 AND inv.quantity_available <= COALESCE(inv.minimum_stock_level, 0)`,
        [tenant_id]
    );
    const lowStockCount = lowStockResult.rows[0]?.count ?? 0;

    let lowStockProducts = [];
    if (lowStockCount > 0) {
        const lowStockListResult = await pool.query(
            `SELECT inv.id, inv.quantity_available, inv.minimum_stock_level,
                    p.id AS product_id, p.name AS product_name, p.sku,
                    w.name AS warehouse_name
             FROM inventories inv
             JOIN products p ON inv.product_id = p.id AND p.tenant_id = inv.tenant_id
             LEFT JOIN warehouses w ON inv.warehouse_id = w.id
             WHERE inv.tenant_id = $1 AND inv.quantity_available <= COALESCE(inv.minimum_stock_level, 0)
             ORDER BY inv.quantity_available ASC
             LIMIT 4`,
            [tenant_id]
        );
        lowStockProducts = lowStockListResult.rows;
    }

    // Expiring soon: inventories with expiration_date in the next 30 days
    const expiringSoonResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM inventories inv
         WHERE inv.tenant_id = $1 AND inv.expiration_date IS NOT NULL
           AND inv.expiration_date >= CURRENT_DATE
           AND inv.expiration_date <= CURRENT_DATE + interval '30 days'`,
        [tenant_id]
    );
    const expiringSoonCount = expiringSoonResult.rows[0]?.count ?? 0;

    let expiringSoonItems = [];
    if (expiringSoonCount > 0) {
        const expiringSoonListResult = await pool.query(
            `SELECT inv.id, inv.quantity_available, inv.expiration_date,
                    p.id AS product_id, p.name AS product_name, p.sku,
                    w.name AS warehouse_name
             FROM inventories inv
             JOIN products p ON inv.product_id = p.id AND p.tenant_id = inv.tenant_id
             LEFT JOIN warehouses w ON inv.warehouse_id = w.id
             WHERE inv.tenant_id = $1 AND inv.expiration_date IS NOT NULL
               AND inv.expiration_date >= CURRENT_DATE
               AND inv.expiration_date <= CURRENT_DATE + interval '30 days'
             ORDER BY inv.expiration_date ASC
             LIMIT 4`,
            [tenant_id]
        );
        expiringSoonItems = expiringSoonListResult.rows;
    }

    return {
        sales: {
            totalCount: Number(sales.total_count),
            totalRevenue: Number(sales.total_revenue),
            monthCount: Number(sales.month_count),
            monthRevenue: Number(sales.month_revenue),
            last7DaysByDay,
        },
        purchases: {
            totalCount: Number(purchases.total_count),
            totalAmount: Number(purchases.total_amount),
            monthCount: Number(purchases.month_count),
            monthAmount: Number(purchases.month_amount),
        },
        expenses: {
            totalCount: Number(expenses.total_count),
            totalAmount: Number(expenses.total_amount),
            monthCount: Number(expenses.month_count),
            monthAmount: Number(expenses.month_amount),
        },
        products: {
            totalCount: productCount,
            activeProducts,
            lowStockCount,
            lowStockProducts,
            expiringSoonCount,
            expiringSoonItems,
        },
        stockValuation: {
            totalValue: totalValueAtCost,
            totalValueAtCost,
            totalValueAtRetail,
            averageValuePerProduct,
            inventoryCount,
        },
        stockStatus: {
            highStockTotal: Number(status.high_stock_total),
            nearLowTotal: Number(status.near_low_total),
            lowStockTotal: Number(status.low_stock_total),
        },
        profit: {
            revenue: grossProfitTotals.revenue,
            grossProfit: grossProfitTotals.grossProfit,
            monthRevenue: grossProfitTotals.monthRevenue,
            monthGrossProfit: grossProfitTotals.monthGrossProfit,
            net: grossProfitTotals.grossProfit - totalExpensesAllTime,
            monthNet: grossProfitTotals.monthGrossProfit - totalExpensesMonth,
        },
    };
};

/**
 * Profit and loss report for a tenant over a date range.
 * Revenue and COGS from sales (same logic as COGS report); expenses from expenses table.
 * Default: last 30 days. Override via startDate/endDate or from/to.
 * Respects user_type for revenue (non-admin sees only own sales).
 */
export const getProfitAndLossService = async (user, requestQuery = {}) => {
    const cogsReport = await getCogsReportService(user, requestQuery);
    // console.log('cogsReport',cogsReport);
    const { startDate, endDate, totalRevenue: revenue, totalCogs: cogs, totalGrossMargin: grossProfit, totalSoldQty } = cogsReport;
    // console.log('totalSoldQty dashboard',totalSoldQty);

    const { tenant_id } = user;
    const expenseResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total
         FROM expenses
         WHERE tenant_id = $1
           AND (COALESCE(expense_date, created_at)::date BETWEEN $2::date AND $3::date)`,
        [tenant_id, startDate, endDate]
    );
    const expenses = Number(expenseResult.rows[0]?.total ?? 0);

    const netProfit = grossProfit - expenses;
    const grossMarginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMarginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    const rt = {
        startDate,
        endDate,
        revenue,
        cogs,
        grossProfit,
        grossMarginPercent,
        expenses,
        netProfit,
        netMarginPercent,
        totalSoldQty,
    };

    return rt;
};

/**
 * Cash flow report for a tenant over a date range.
 * Inflows: sales. Outflows: purchases, expenses.
 * Default: last 30 days. Override via startDate/endDate or from/to.
 * Respects user_type for sales (non-admin sees only own sales).
 */
export const getCashFlowService = async (user, requestQuery = {}) => {
    const { tenant_id, user_type, id: userId } = user;

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

    const records = [];
    let totalInflow = 0;
    let totalOutflow = 0;

    const salesWhere = ["s.tenant_id = $1", "s.created_at::date BETWEEN $2::date AND $3::date"];
    const salesParams = [tenant_id, startDate, endDate];
    if (user_type != 1) {
        salesWhere.push("s.creator_id = $4");
        salesParams.push(userId);
    }
    const salesResult = await pool.query(
        `SELECT s.id, s.total_amount, s.created_at, s.invoice_number
         FROM sales s
         WHERE ${salesWhere.join(" AND ")}
         ORDER BY s.created_at ASC`,
        salesParams
    );
    for (const row of salesResult.rows) {
        const amount = Number(row.total_amount || 0);
        totalInflow += amount;
        const d = row.created_at;
        const date = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
        records.push({
            id: row.id,
            date,
            amount,
            total: amount,
            type: "sale",
            reference: row.invoice_number || null,
        });
    }

    const purchasesResult = await pool.query(
        `SELECT id, total_amount, created_at, invoice_number
         FROM purchases
         WHERE tenant_id = $1 AND created_at::date BETWEEN $2::date AND $3::date
         ORDER BY created_at ASC`,
        [tenant_id, startDate, endDate]
    );
    for (const row of purchasesResult.rows) {
        const amount = -Number(row.total_amount || 0);
        totalOutflow += Math.abs(amount);
        const d = row.created_at;
        const date = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
        records.push({
            id: row.id,
            date,
            amount,
            total: Math.abs(amount),
            type: "purchase",
            reference: row.invoice_number || null,
        });
    }

    const expensesResult = await pool.query(
        `SELECT id, amount, COALESCE(expense_date, created_at) AS dt, voucher
         FROM expenses
         WHERE tenant_id = $1
           AND (COALESCE(expense_date, created_at)::date BETWEEN $2::date AND $3::date)
         ORDER BY dt ASC`,
        [tenant_id, startDate, endDate]
    );
    for (const row of expensesResult.rows) {
        const amount = -Number(row.amount || 0);
        totalOutflow += Math.abs(amount);
        const d = row.dt;
        const date = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
        records.push({
            id: row.id,
            date,
            amount,
            total: Math.abs(amount),
            type: "expense",
            reference: row.voucher || null,
        });
    }

    records.sort((a, b) => {
        const c = a.date.localeCompare(b.date);
        return c !== 0 ? c : (a.id || "").localeCompare(b.id || "");
    });

    const netFlow = totalInflow - totalOutflow;

    return {
        startDate,
        endDate,
        totalInflow,
        totalOutflow,
        netFlow,
        records,
    };
};
