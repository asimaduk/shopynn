import pool from "../config/db.js";

const buildSaleDetailsWhere = (tenant_id, productSlug, startDate, endDate, productNameSearch, productId) => {
    const conditions = ["saledetails.tenant_id = $1"];
    const params = [tenant_id];
    let i = 2;
    
    if (productId) {
        conditions.push(`saledetails.product_id = $${i++}`);
        params.push(productId);
    }
    if (productSlug) {
        conditions.push(`products.slug = $${i++}`);
        params.push(productSlug);
    }
    if (startDate && endDate) {
        conditions.push(`saledetails.created_at BETWEEN $${i} AND $${i + 1}`);
        params.push(startDate, endDate);
        i += 2;
    }
    if (productNameSearch && String(productNameSearch).trim()) {
        conditions.push(`products.name ILIKE $${i++}`);
        params.push(`%${String(productNameSearch).trim()}%`);
    }
    
    return { where: conditions.join(" AND "), params };
};

const buildPurchaseDetailsWhere = (tenant_id, productSlug, startDate, endDate, productNameSearch, productId) => {
    const conditions = ["purchasedetails.tenant_id = $1"];
    const params = [tenant_id];
    let i = 2;
    if (productId) {
        conditions.push(`purchasedetails.product_id = $${i++}`);
        params.push(productId);
    }

    if (productSlug) {
        conditions.push(`products.slug = $${i++}`);
        params.push(productSlug);
    }
    if (startDate && endDate) {
        conditions.push(`purchasedetails.created_at BETWEEN $${i} AND $${i + 1}`);
        params.push(startDate, endDate);
        i += 2;
    }
    if (productNameSearch && String(productNameSearch).trim()) {
        conditions.push(`products.name ILIKE $${i++}`);
        params.push(`%${String(productNameSearch).trim()}%`);
    }

    return { where: conditions.join(" AND "), params };
};

const saleDetailsSelect = "SELECT saledetails.id, saledetails.sale_id, saledetails.product_id, saledetails.quantity, saledetails.created_at, saledetails.unit_price, sales.invoice_number, products.name, products.thumbnail, warehouses.name as warehouse, users.first_name, users.last_name FROM saledetails LEFT JOIN sales ON saledetails.sale_id = sales.id LEFT JOIN products ON saledetails.product_id = products.id LEFT JOIN warehouses ON saledetails.warehouse_id = warehouses.id LEFT JOIN users ON saledetails.creator_id = users.id";
const purchaseDetailsSelect = "SELECT purchasedetails.id, purchasedetails.purchase_id, purchasedetails.product_id, purchasedetails.quantity, purchasedetails.created_at, purchasedetails.unit_price, purchases.invoice_number, products.name, products.thumbnail, warehouses.name as warehouse, users.first_name, users.last_name FROM purchasedetails LEFT JOIN purchases ON purchasedetails.purchase_id = purchases.id LEFT JOIN products ON purchasedetails.product_id = products.id LEFT JOIN warehouses ON purchasedetails.warehouse_id = warehouses.id LEFT JOIN users ON purchasedetails.creator_id = users.id";

export const getAllTransactionsService = async (productSlug, startDate, endDate, tenant_id, requestQuery = {}) => {
    // console.log('requestQuery',requestQuery);
    const productNameSearch = requestQuery?.name ?? requestQuery?.search ?? requestQuery?.q;
    const productId = requestQuery?.product_id;
    const arr = [];
    const saleWhere = buildSaleDetailsWhere(tenant_id, productSlug, startDate, endDate, productNameSearch, productId);
    const purchaseWhere = buildPurchaseDetailsWhere(tenant_id, productSlug, startDate, endDate, productNameSearch, productId);

    let result1 = [];
    let result2 = [];

    if (requestQuery.type === 'all' || requestQuery.type === 'sale') {
        result1 = await pool.query(`${saleDetailsSelect} WHERE ${saleWhere.where}`, saleWhere.params);
        if (result1.rowCount > 0) {
            arr.push(...result1.rows.map((r) => ({ ...r, type: 0 })));
        }
    }

    if (requestQuery.type === 'all' || requestQuery.type === 'stock_in') {
        result2 = await pool.query(`${purchaseDetailsSelect} WHERE ${purchaseWhere.where}`, purchaseWhere.params);
        if (result2.rowCount > 0) {
            arr.push(...result2.rows.map((r) => ({ ...r, type: 1 })));
        }
    }

    arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return arr;
}

export const getTransactionByIdService = async (id) => {
    const result = await pool.query("SELECT id, amount, voucher, description, note, category, payment_method, expensed_by, expense_date, created_at FROM expenses where id = $1", [id]);
    return result.rows[0];
}