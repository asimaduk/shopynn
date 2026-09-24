import pool from "../config/db.js";

function csvEscape(value) {
    if (value == null) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function toCsv(headers, rows) {
    const lines = [headers.join(",")];
    for (const row of rows) {
        lines.push(headers.map((h) => csvEscape(row[h])).join(","));
    }
    return `${lines.join("\n")}\n`;
}

/**
 * Bookkeeper pack: dated sales, purchases, and expenses for a tenant.
 * @param {{ tenantId: string, startDate?: string, endDate?: string }} opts
 */
export async function buildAccountantPackService({ tenantId, startDate, endDate }) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        const err = new Error("Invalid startDate or endDate.");
        err.status = 400;
        throw err;
    }
    const endInclusive = new Date(end);
    endInclusive.setHours(23, 59, 59, 999);

    const salesRes = await pool.query(
        `SELECT s.id, s.invoice_number, COALESCE(s.sale_date, s.created_at) AS sale_date,
                s.total_amount, s.discount_amount, s.amount_paid, s.balance_due,
                s.payment_status, s.notes, c.name AS customer_name, w.name AS warehouse_name
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN warehouses w ON w.id = s.warehouse_id
         WHERE s.tenant_id = $1
           AND COALESCE(s.sale_date, s.created_at) BETWEEN $2 AND $3
         ORDER BY COALESCE(s.sale_date, s.created_at) ASC`,
        [tenantId, start, endInclusive]
    );

    const purchasesRes = await pool.query(
        `SELECT p.id, p.invoice_number, p.created_at AS purchase_date,
                p.total_amount, p.discount_amount, p.amount_paid, p.payment_status,
                p.notes, s.name AS supplier_name, w.name AS warehouse_name
         FROM purchases p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         LEFT JOIN warehouses w ON w.id = p.warehouse_id
         WHERE p.tenant_id = $1
           AND p.created_at BETWEEN $2 AND $3
         ORDER BY p.created_at ASC`,
        [tenantId, start, endInclusive]
    );

    const expensesRes = await pool.query(
        `SELECT e.id, e.expense_date, e.amount, e.category, e.description, e.note,
                e.payment_method, e.expensed_by, w.name AS warehouse_name
         FROM expenses e
         LEFT JOIN warehouses w ON w.id = e.warehouse_id
         WHERE e.tenant_id = $1
           AND COALESCE(e.expense_date, e.created_at) BETWEEN $2 AND $3
         ORDER BY COALESCE(e.expense_date, e.created_at) ASC`,
        [tenantId, start, endInclusive]
    );

    const salesHeaders = [
        "id",
        "invoice_number",
        "sale_date",
        "customer_name",
        "warehouse_name",
        "total_amount",
        "discount_amount",
        "amount_paid",
        "balance_due",
        "payment_status",
        "notes",
    ];
    const purchaseHeaders = [
        "id",
        "invoice_number",
        "purchase_date",
        "supplier_name",
        "warehouse_name",
        "total_amount",
        "discount_amount",
        "amount_paid",
        "payment_status",
        "notes",
    ];
    const expenseHeaders = [
        "id",
        "expense_date",
        "amount",
        "category",
        "description",
        "note",
        "payment_method",
        "expensed_by",
        "warehouse_name",
    ];

    const rangeLabel = `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`;

    return {
        range: { start: start.toISOString(), end: endInclusive.toISOString() },
        files: [
            { filename: `sales_${rangeLabel}.csv`, content: toCsv(salesHeaders, salesRes.rows) },
            { filename: `purchases_${rangeLabel}.csv`, content: toCsv(purchaseHeaders, purchasesRes.rows) },
            { filename: `expenses_${rangeLabel}.csv`, content: toCsv(expenseHeaders, expensesRes.rows) },
        ],
        counts: {
            sales: salesRes.rowCount,
            purchases: purchasesRes.rowCount,
            expenses: expensesRes.rowCount,
        },
    };
}

export default { buildAccountantPackService };
