import pool from "../config/db.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getUserPermissionsService } from "./userRole.js";
import { createNotificationService } from "./notification.js";
import {
    createPaymentService,
    logPaymentEventService,
    createPendingPaymentForCheckoutService,
    getPaymentByTransactionRefService,
    updatePaymentStatusByTransactionRefService,
    syncOrderPaymentAfterSuccess,
} from "./payment.js";
import { initiateCheckout, submitChargeOtp } from "../services/paymentGateway.js";
import { sendToTokens } from "../services/firebaseMessaging.js";
import {
    assertFulfillmentAllowedForInstallment,
    applyOrderPartialPayment,
    computeRequiredInitialPayment,
    createInstallmentLedgerRow,
    enrichOrderInstallmentFields,
    getInstallmentPaymentsForOrder,
    isInstallmentOrder,
    loadProductsForInstallmentCheck,
    normalizePaymentMode,
    resolveMinPartialPayment,
    toMoney,
    validateInstallmentCart,
    validatePartialPaymentAmount,
} from "./orderInstallment.js";

const ORDER_STATUS_TRANSITIONS = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["ready"],
    ready: ["shipped", "completed"],
    shipped: ["delivered"],
    delivered: ["completed"],
    completed: [],
    cancelled: [],
};

const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

const normalizePaymentStatus = (status) => String(status || "").trim().toLowerCase();

/** Coerce pg numeric / string decimals to JS number for JSON APIs. */
const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

/** Permissions that imply a user should receive store-side order alerts. */
const STAFF_ORDER_FCM_PERMISSIONS = [
    "orders.multi_store.manage",
    "orders.store.manage",
    "orders.store.view",
    "orders.status.update",
    "orders.process",
    "orders.view",
];

function wantsOrderPushFromPreferences(preferences) {
    if (!preferences || typeof preferences !== "object") return true;
    const n = preferences.notifications;
    if (!n || typeof n !== "object") return true;
    if (n.push === false) return false;
    const types = n.types;
    if (types == null) return true;
    if (Array.isArray(types)) {
        if (types.includes("onlineOrders")) return true;
        if (types.includes("approvals")) return true;
        return false;
    }
    if (typeof types === "object") {
        if (types.onlineOrders === false) return false;
        if (types.onlineOrders === true) return true;
        if (types.approvals === false) return false;
        return true;
    }
    return true;
}

function formatOrderStatusForMessage(status) {
    const v = normalizeStatus(status);
    if (!v) return "Updated";
    return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Staff users (tenant) who can act on orders for this warehouse and have an FCM token.
 * Excludes excludeUserId when set (e.g. creator) to avoid duplicate self-alerts when that user is staff.
 */
async function loadStaffFcmRowsForWarehouseOrder(tenantId, warehouseId, excludeUserId) {
    if (!tenantId || !warehouseId) return [];
    const result = await pool.query(
        `SELECT DISTINCT u.id, u.fcm_token, up.preferences
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         LEFT JOIN user_preferences up ON up.user_id = u.id
         WHERE u.tenant_id = $1
           AND COALESCE(u.is_active, true) = true
           AND COALESCE(u.deleted, false) = false
           AND u.fcm_token IS NOT NULL
           AND btrim(u.fcm_token) <> ''
           AND (r.tenant_id = u.tenant_id OR r.tenant_id IS NULL)
           AND (
             lower(r.name) = 'super admin'
             OR EXISTS (
               SELECT 1 FROM role_permissions rp
               INNER JOIN permissions p ON p.id = rp.permission_id
               WHERE rp.role_id = r.id AND p.code = ANY($2::text[])
             )
           )
           AND (
             u.user_type = 1
             OR EXISTS (
               SELECT 1 FROM user_roles ur2
               INNER JOIN roles r2 ON r2.id = ur2.role_id
               INNER JOIN role_permissions rp2 ON rp2.role_id = r2.id
               INNER JOIN permissions p2 ON p2.id = rp2.permission_id
               WHERE ur2.user_id = u.id
                 AND (r2.tenant_id = u.tenant_id OR r2.tenant_id IS NULL)
                 AND p2.code = 'orders.multi_store.manage'
             )
             OR u.warehouse_id = $3
             OR EXISTS (
               SELECT 1 FROM user_warehouse_access uwa
               WHERE uwa.user_id = u.id AND uwa.tenant_id = u.tenant_id AND uwa.warehouse_id = $3
             )
           )
           AND ($4::varchar IS NULL OR $4::varchar = '' OR u.id <> $4::varchar)`,
        [tenantId, STAFF_ORDER_FCM_PERMISSIONS, warehouseId, excludeUserId ?? null]
    );
    return result.rows;
}

async function sendStaffNewOrderFcm({ tenantId, warehouseId, orderId, orderNumber, excludeUserId }) {
    try {
        const rows = await loadStaffFcmRowsForWarehouseOrder(tenantId, warehouseId, excludeUserId);
        const tokens = [];
        const seen = new Set();
        for (const row of rows) {
            if (!wantsOrderPushFromPreferences(row.preferences)) continue;
            const t = String(row.fcm_token || "").trim();
            if (!t || seen.has(t)) continue;
            seen.add(t);
            tokens.push(t);
        }
        if (tokens.length === 0) return;
        const wh = await pool.query(`SELECT name FROM warehouses WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [warehouseId, tenantId]);
        const storeName = String(wh.rows[0]?.name || "").trim() || "Store";
        const num = orderNumber || "Order";
        await sendToTokens(tokens, {
            notification: { title: "New order", body: `${num} · ${storeName}` },
            data: {
                type: "order_created",
                order_id: String(orderId),
                order_number: num,
                warehouse_id: String(warehouseId),
                mobile_screen: "Orders",
            },
        });
    } catch {
        /* non-blocking */
    }
}

async function sendCustomerOrderStatusFcm({ tenantId, customerUserId, orderId, orderNumber, status }) {
    if (!customerUserId) return;
    try {
        const r = await pool.query(
            `SELECT u.fcm_token, coalesce(up.preferences, '{}'::jsonb) AS preferences
             FROM users u
             LEFT JOIN user_preferences up ON up.user_id = u.id
             WHERE u.id = $1 AND u.tenant_id = $2
             LIMIT 1`,
            [customerUserId, tenantId]
        );
        const row = r.rows[0];
        const token = String(row?.fcm_token || "").trim();
        if (!token || !wantsOrderPushFromPreferences(row?.preferences)) return;
        const num = orderNumber || "Order";
        const label = formatOrderStatusForMessage(status);
        await sendToTokens(token, {
            notification: { title: "Order updated", body: `${num} is now ${label}.` },
            data: {
                type: "order_status",
                order_id: String(orderId),
                order_number: num,
                status: normalizeStatus(status),
                mobile_screen: "OrderDetails",
            },
        });
    } catch {
        /* non-blocking */
    }
}

// Human-friendly, collision-resistant order numbers (Option B)
// Crockford Base32 alphabet (no I, L, O, U) to reduce confusion when read over the phone.
const ORDER_NO_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function base32Crockford(bytes) {
    let bits = 0;
    let value = 0;
    let out = "";
    for (const b of bytes) {
        value = (value << 8) | b;
        bits += 8;
        while (bits >= 5) {
            out += ORDER_NO_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        out += ORDER_NO_ALPHABET[(value << (5 - bits)) & 31];
    }
    return out;
}

function generateOrderNumber() {
    // 64 bits -> 13 base32 chars; take 12 chars and format as XXXXs.
    const raw = base32Crockford(crypto.randomBytes(8)).slice(0, 12);
    return `ORD-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

const canAccessWarehouse = async (user, warehouseId) => {
    if (!warehouseId) return false;
    if (user.user_type === 1) return true;
    if (user.warehouse_id && user.warehouse_id === warehouseId) return true;

    const result = await pool.query(
        `SELECT 1
         FROM user_warehouse_access
         WHERE user_id = $1 AND tenant_id = $2 AND warehouse_id = $3
         LIMIT 1`,
        [user.id, user.tenant_id, warehouseId]
    );
    return result.rowCount > 0;
};

const getScopedWarehouseIds = async (user) => {
    if (user.user_type === 1) return [];
    const result = await pool.query(
        `SELECT warehouse_id
         FROM user_warehouse_access
         WHERE user_id = $1 AND tenant_id = $2`,
        [user.id, user.tenant_id]
    );
    const ids = result.rows.map((row) => row.warehouse_id).filter(Boolean);
    if (user.warehouse_id && !ids.includes(user.warehouse_id)) {
        ids.push(user.warehouse_id);
    }
    return ids;
};

const getPermissionsForUser = async (user) => {
    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
        return user.permissions;
    }
    return getUserPermissionsService(user.id, user.tenant_id).catch(() => []);
};

const canManageMultiStoreOrders = async (user) => {
    if (user.user_type === 1) return true;
    const permissionCodes = await getPermissionsForUser(user);
    return permissionCodes.includes("orders.multi_store.manage");
};

const getCustomerProfileForUser = async (user) => {
    const result = await pool.query(
        `SELECT id, user_id, tenant_id
         FROM customer_profiles
         WHERE user_id = $1 AND tenant_id = $2
         LIMIT 1`,
        [user.id, user.tenant_id]
    );
    return result.rows[0] ?? null;
};

const customerHasStoreAccess = async (customerProfileId, warehouseId, tenantId) => {
    const result = await pool.query(
        `SELECT 1
         FROM customer_store_access
         WHERE customer_profile_id = $1 AND warehouse_id = $2 AND tenant_id = $3
         LIMIT 1`,
        [customerProfileId, warehouseId, tenantId]
    );
    return result.rowCount > 0;
};

const validateOrderItemForWarehouse = async (tenantId, warehouseId, item) => {
    const productId = item.product_id || item.productId;
    if (!productId) throw new Error("Each order item must include product_id.");

    const productResult = await pool.query(
        `SELECT id, name, allows_fractional_qty, min_order_qty, qty_step
         FROM products
         WHERE id = $1 AND tenant_id = $2
         LIMIT 1`,
        [productId, tenantId]
    );
    const product = productResult.rows[0];
    if (!product) throw new Error(`Product not found: ${productId}`);

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Each order item must have quantity > 0.");
    }
    if (!product.allows_fractional_qty && !Number.isInteger(quantity)) {
        throw new Error(`Product ${product.name} requires whole-number quantity.`);
    }

    const minQty = Number(product.min_order_qty ?? 0) || 0;
    if (minQty > 0 && quantity < minQty) {
        throw new Error(`Minimum quantity for ${product.name} is ${minQty}.`);
    }

    const qtyStep = Number(product.qty_step ?? 0) || 0;
    if (qtyStep > 0) {
        const quotient = quantity / qtyStep;
        const rounded = Math.round(quotient * 1000000) / 1000000;
        if (Math.abs(rounded - Math.round(rounded)) > 1e-6) {
            throw new Error(`Quantity for ${product.name} must follow step ${qtyStep}.`);
        }
    }

    const inventoryResult = await pool.query(
        `SELECT coalesce(quantity_available, 0)::numeric AS quantity_available
         FROM inventories
         WHERE tenant_id = $1 AND warehouse_id = $2 AND product_id = $3
         LIMIT 1`,
        [tenantId, warehouseId, productId]
    );
    const available = Number(inventoryResult.rows[0]?.quantity_available ?? 0);
    if (available < quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${available}.`);
    }

    return { product, quantity };
};

export const getOrdersService = async (user, requestQuery = {}) => {
    const values = [user.tenant_id];
    const conditions = ["o.tenant_id = $1"];
    let paramIndex = 2;

    const canManageAllStores = await canManageMultiStoreOrders(user);
    if (!canManageAllStores) {
        const scopedWarehouseIds = await getScopedWarehouseIds(user);
        if (!scopedWarehouseIds.length) return [];
        conditions.push(`o.warehouse_id = ANY($${paramIndex})`);
        values.push(scopedWarehouseIds);
        paramIndex += 1;
    }

    const customerProfile = await getCustomerProfileForUser(user);
    if (customerProfile && !canManageAllStores) {
        conditions.push(`o.customer_profile_id = $${paramIndex}`);
        values.push(customerProfile.id);
        paramIndex += 1;
    }

    if (requestQuery.warehouse_id || requestQuery.warehouseId) {
        conditions.push(`o.warehouse_id = $${paramIndex}`);
        values.push(requestQuery.warehouse_id || requestQuery.warehouseId);
        paramIndex += 1;
    }

    if (requestQuery.status) {
        conditions.push(`lower(o.status) = $${paramIndex}`);
        values.push(normalizeStatus(requestQuery.status));
        paramIndex += 1;
    }

    const result = await pool.query(
        `SELECT o.id, o.order_number, o.status, o.fulfillment_type, o.total_amount, o.payment_status,
                o.payment_mode, o.amount_paid, o.balance_due,
                o.created_at, o.updated_at, o.warehouse_id,
                w.name AS warehouse_name, w.phone AS warehouse_phone, w.manager AS warehouse_contact,
                o.customer_profile_id, cp.user_id AS customer_user_id,
                nullif(trim(concat(coalesce(cu.first_name, ''), ' ', coalesce(cu.last_name, ''))), '') AS customer_name,
                oi_meta.order_items AS order_items
         FROM orders o
         LEFT JOIN warehouses w ON w.id = o.warehouse_id
         LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
         LEFT JOIN users cu ON cu.id = cp.user_id
         LEFT JOIN LATERAL (
            SELECT coalesce(
                json_agg(
                    json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'product_name', p.name,
                        'thumbnail', coalesce(p.thumbnail, p.picture1, p.picture2, p.picture3, p.picture4)
                    )
                    ORDER BY oi.created_at ASC
                ),
                '[]'::json
            ) AS order_items
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = o.id
         ) oi_meta ON true
         WHERE ${conditions.join(" AND ")}
         ORDER BY o.created_at DESC`,
        values
    );

    return result.rows;
};

export const getStoreOrdersService = async (user, requestQuery = {}) => {
    const values = [user.tenant_id];
    const conditions = ["o.tenant_id = $1"];
    let paramIndex = 2;

    const canManageAllStores = await canManageMultiStoreOrders(user);
    if (!canManageAllStores) {
        const scopedWarehouseIds = await getScopedWarehouseIds(user);
        if (!scopedWarehouseIds.length) return [];
        conditions.push(`o.warehouse_id = ANY($${paramIndex})`);
        values.push(scopedWarehouseIds);
        paramIndex += 1;
    }

    if (requestQuery.warehouse_id || requestQuery.warehouseId) {
        conditions.push(`o.warehouse_id = $${paramIndex}`);
        values.push(requestQuery.warehouse_id || requestQuery.warehouseId);
        paramIndex += 1;
    }

    if (requestQuery.status) {
        conditions.push(`lower(o.status) = $${paramIndex}`);
        values.push(normalizeStatus(requestQuery.status));
        paramIndex += 1;
    }

    if (requestQuery.fulfillment_type) {
        conditions.push(`lower(o.fulfillment_type) = $${paramIndex}`);
        values.push(String(requestQuery.fulfillment_type).trim().toLowerCase());
        paramIndex += 1;
    }

    if (requestQuery.startDate) {
        conditions.push(`o.created_at >= $${paramIndex}`);
        values.push(requestQuery.startDate);
        paramIndex += 1;
    }

    if (requestQuery.endDate) {
        conditions.push(`o.created_at <= $${paramIndex}`);
        values.push(requestQuery.endDate);
        paramIndex += 1;
    }

    const result = await pool.query(
        `SELECT o.id, o.order_number, o.status, o.fulfillment_type, o.total_amount, o.payment_status,
                o.payment_mode, o.amount_paid, o.balance_due,
                o.created_at, o.updated_at, o.warehouse_id,
                w.name AS warehouse_name, w.phone AS warehouse_phone, w.manager AS warehouse_contact,
                o.customer_profile_id, cp.user_id AS customer_user_id,
                nullif(trim(concat(coalesce(cu.first_name, ''), ' ', coalesce(cu.last_name, ''))), '') AS customer_name,
                oi_meta.order_items AS order_items
         FROM orders o
         LEFT JOIN warehouses w ON w.id = o.warehouse_id
         LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
         LEFT JOIN users cu ON cu.id = cp.user_id
         LEFT JOIN LATERAL (
            SELECT coalesce(
                json_agg(
                    json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'product_name', p.name,
                        'thumbnail', coalesce(p.thumbnail, p.picture1, p.picture2, p.picture3, p.picture4)
                    )
                    ORDER BY oi.created_at ASC
                ),
                '[]'::json
            ) AS order_items
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = o.id
         ) oi_meta ON true
         WHERE ${conditions.join(" AND ")}
         ORDER BY o.created_at DESC`,
        values
    );

    return result.rows;
};

export const getOrderByIdService = async (user, orderId) => {
    const result = await pool.query(
        `SELECT o.*,
                w.name AS warehouse_name, w.phone AS warehouse_phone, w.manager AS warehouse_contact,
                cp.user_id AS customer_user_id,
                nullif(trim(concat(coalesce(cu.first_name, ''), ' ', coalesce(cu.last_name, ''))), '') AS customer_name
         FROM orders o
         LEFT JOIN warehouses w ON w.id = o.warehouse_id
         LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
         LEFT JOIN users cu ON cu.id = cp.user_id
         WHERE o.id = $1 AND o.tenant_id = $2
         LIMIT 1`,
        [orderId, user.tenant_id]
    );
    const order = result.rows[0];
    if (!order) return null;

    const canManageAllStores = await canManageMultiStoreOrders(user);
    if (!canManageAllStores) {
        const scopedWarehouseIds = await getScopedWarehouseIds(user);
        const customerProfile = await getCustomerProfileForUser(user);
        const isCustomerOrder = customerProfile && order.customer_profile_id === customerProfile.id;
        const inStaffScope = scopedWarehouseIds.includes(order.warehouse_id);
        if (!isCustomerOrder && !inStaffScope) return null;
    }

    const itemsResult = await pool.query(
        `SELECT oi.id, oi.product_id, p.name AS product_name, p.sku,
                coalesce(p.thumbnail, p.picture1, p.picture2, p.picture3, p.picture4) AS thumbnail,
                oi.quantity, oi.unit_price, oi.line_total, oi.notes
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1
         ORDER BY oi.created_at ASC`,
        [orderId]
    );
    order.items = itemsResult.rows.map((row) => ({
        ...row,
        quantity: toNumber(row.quantity),
        unit_price: toNumber(row.unit_price),
        line_total: toNumber(row.line_total),
    }));

    order.subtotal_amount = toNumber(order.subtotal_amount);
    order.discount_amount = toNumber(order.discount_amount);
    order.delivery_fee = toNumber(order.delivery_fee);
    order.total_amount = toNumber(order.total_amount);

    const historyResult = await pool.query(
        `SELECT id, from_status, to_status, reason, changed_by, created_at
         FROM order_status_history
         WHERE order_id = $1
         ORDER BY created_at ASC`,
        [orderId]
    );
    order.history = historyResult.rows;

    const deliveryResult = await pool.query(
        `SELECT id, order_id, courier_name, courier_phone, tracking_number, dispatch_note, delivery_note, dispatched_at, delivered_at, created_at, updated_at
         FROM order_deliveries
         WHERE order_id = $1
         LIMIT 1`,
        [orderId]
    );
    order.delivery = deliveryResult.rows[0] ?? null;

    order.amount_paid = toMoney(order.amount_paid);
    order.balance_due = toMoney(order.balance_due);
    const ledger = await getInstallmentPaymentsForOrder(orderId, user.tenant_id);
    return enrichOrderInstallmentFields(order, ledger);
};

export const createOrderService = async (user, payload = {}) => {
    const { warehouse_id, fulfillment_type, notes, delivery_address, items, payment_mode, initial_payment_amount } =
        payload;
    if (!warehouse_id) throw new Error("warehouse_id is required.");
    if (!Array.isArray(items) || items.length === 0) throw new Error("Order must include at least one item.");

    const canManageAllStores = await canManageMultiStoreOrders(user);
    if (!canManageAllStores) {
        const allowed = await canAccessWarehouse(user, warehouse_id);
        if (!allowed) throw new Error("You cannot create orders for this store.");
    }

    const customerProfile = await getCustomerProfileForUser(user);
    if (customerProfile) {
        const canAccessStore = await customerHasStoreAccess(customerProfile.id, warehouse_id, user.tenant_id);
        if (!canAccessStore) throw new Error("You are not linked to this store.");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const orderId = uuidv4();
        let orderNumber = null;
        let subtotal = 0;

        for (const item of items) {
            const { quantity } = await validateOrderItemForWarehouse(user.tenant_id, warehouse_id, item);
            const unitPrice = Number(item.unit_price ?? item.unitPrice ?? 0);
            subtotal += quantity * unitPrice;
        }

        const whMinRes = await client.query(
            `SELECT coalesce(minimum_order_amount, 0)::numeric AS minimum_order_amount
             FROM warehouses WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [warehouse_id, user.tenant_id]
        );
        const minOrderAmt = Number(whMinRes.rows[0]?.minimum_order_amount ?? 0);
        if (minOrderAmt > 0 && subtotal < minOrderAmt) {
            throw new Error(
                `Minimum order for this store is GHS ${minOrderAmt.toFixed(2)}. Your order total is GHS ${Number(subtotal).toFixed(2)}.`
            );
        }

        const productIds = items.map((i) => i.product_id || i.productId).filter(Boolean);
        const installmentProducts = await loadProductsForInstallmentCheck(
            user.tenant_id,
            warehouse_id,
            productIds
        );
        const isInstallment = normalizePaymentMode(payment_mode) === "installment";
        let amountPaid = 0;
        let balanceDue = toMoney(subtotal);
        let orderPaymentStatus = "unpaid";

        if (isInstallment) {
            validateInstallmentCart(installmentProducts);
            const requiredInitial = computeRequiredInitialPayment(subtotal, installmentProducts);
            const initialRaw = initial_payment_amount ?? payload.initialPaymentAmount ?? 0;
            amountPaid = toMoney(initialRaw);
            if (amountPaid < requiredInitial - 0.02) {
                throw new Error(
                    `Minimum initial payment is GHS ${requiredInitial.toFixed(2)} for pay-over-time checkout.`
                );
            }
            if (amountPaid > subtotal + 0.02) {
                throw new Error("Initial payment cannot exceed order total.");
            }
            balanceDue = toMoney(Math.max(0, subtotal - amountPaid));
            orderPaymentStatus = balanceDue <= 0 ? "paid" : "installment_active";
        }

        let insertOrderResult = null;
        for (let attempt = 0; attempt < 10; attempt += 1) {
            orderNumber = generateOrderNumber();
            try {
                await client.query("SAVEPOINT order_insert");
                insertOrderResult = await client.query(
                    `INSERT INTO orders (
                        id, order_number, tenant_id, customer_profile_id, warehouse_id, status,
                        fulfillment_type, subtotal_amount, total_amount, notes, delivery_address,
                        created_by_user_id, payment_status, payment_mode, amount_paid, balance_due,
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, 'pending',
                        $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15,
                        now(), now()
                    )
                    RETURNING *`,
                    [
                        orderId,
                        orderNumber,
                        user.tenant_id,
                        customerProfile?.id ?? null,
                        warehouse_id,
                        fulfillment_type || "pickup",
                        subtotal,
                        subtotal,
                        notes || null,
                        delivery_address || null,
                        user.id,
                        orderPaymentStatus,
                        isInstallment ? "installment" : "full",
                        amountPaid,
                        balanceDue,
                    ]
                );
                await client.query("RELEASE SAVEPOINT order_insert");
                break;
            } catch (error) {
                // Any error aborts the transaction unless we rollback to a savepoint.
                await client.query("ROLLBACK TO SAVEPOINT order_insert").catch(() => null);
                if (error?.code === "23505") {
                    // Unique violation on order_number - retry with a new code.
                    continue;
                }
                throw error;
            }
        }
        if (!insertOrderResult) {
            throw new Error("Failed to generate a unique order number. Please retry.");
        }

        for (const item of items) {
            const itemId = uuidv4();
            const quantity = Number(item.quantity);
            const unitPrice = Number(item.unit_price ?? item.unitPrice ?? 0);
            await client.query(
                `INSERT INTO order_items (
                    id, order_id, product_id, tenant_id, warehouse_id, quantity,
                    unit_price, line_total, notes, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, now(), now()
                )`,
                [
                    itemId,
                    orderId,
                    item.product_id || item.productId,
                    user.tenant_id,
                    warehouse_id,
                    quantity,
                    unitPrice,
                    quantity * unitPrice,
                    item.notes || null,
                ]
            );
        }

        await client.query(
            `INSERT INTO order_status_history (
                id, order_id, tenant_id, from_status, to_status, reason, changed_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
            [uuidv4(), orderId, user.tenant_id, null, "pending", "Order created", user.id]
        );

        if (isInstallment && amountPaid > 0) {
            await createInstallmentLedgerRow(client, {
                order_id: orderId,
                tenant_id: user.tenant_id,
                amount: amountPaid,
                payment_method: "checkout_initial",
                status: "completed",
                recorded_by: user.id,
                note: "Initial payment at checkout",
            });
        }

        await client.query("COMMIT");

        await createNotificationService({
            tenant_id: user.tenant_id,
            user_id: null,
            type: "order_created",
            title: "New order received",
            message: `Order ${orderNumber} has been placed.`,
            mobile_screen: "Orders",
            mobile_params: { order_id: orderId, warehouse_id },
        }).catch(() => null);

        void sendStaffNewOrderFcm({
            tenantId: user.tenant_id,
            warehouseId: warehouse_id,
            orderId,
            orderNumber,
            excludeUserId: user.id,
        });

        return getOrderByIdService(user, orderId);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const updateOrderService = async (user, orderId, payload = {}) => {
    const order = await getOrderByIdService(user, orderId);
    if (!order) return null;
    if (!["pending", "confirmed"].includes(normalizeStatus(order.status))) {
        throw new Error("Only pending or confirmed orders can be updated.");
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (payload.fulfillment_type) {
        updates.push(`fulfillment_type = $${idx++}`);
        values.push(payload.fulfillment_type);
    }
    if (payload.notes !== undefined) {
        updates.push(`notes = $${idx++}`);
        values.push(payload.notes || null);
    }
    if (payload.delivery_address !== undefined) {
        updates.push(`delivery_address = $${idx++}`);
        values.push(payload.delivery_address || null);
    }

    if (!updates.length) return order;

    values.push(orderId, user.tenant_id);
    const result = await pool.query(
        `UPDATE orders
         SET ${updates.join(", ")}, updated_at = now()
         WHERE id = $${idx++} AND tenant_id = $${idx}
         RETURNING *`,
        values
    );

    return result.rows[0] ?? null;
};

export const updateOrderStatusService = async (user, orderId, toStatus, reason = null) => {
    const normalized = normalizeStatus(toStatus);
    const order = await getOrderByIdService(user, orderId);
    if (!order) return null;

    const fulfillmentTargets = ["ready", "shipped", "delivered", "completed"];
    if (fulfillmentTargets.includes(normalized)) {
        assertFulfillmentAllowedForInstallment(order);
    }

    const fromStatus = normalizeStatus(order.status);
    const allowed = ORDER_STATUS_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(normalized)) {
        throw new Error(`Invalid status transition from ${fromStatus} to ${normalized}.`);
    }
    if ((normalized === "shipped" || normalized === "delivered") && normalizeStatus(order.fulfillment_type) !== "delivery") {
        throw new Error("Only delivery orders can be marked shipped or delivered.");
    }

    const result = await pool.query(
        `UPDATE orders
         SET status = $1,
             cancelled_at = CASE WHEN $5 THEN now() ELSE cancelled_at END,
             cancelled_by = CASE WHEN $5 THEN $2 ELSE cancelled_by END,
             updated_at = now()
         WHERE id = $3 AND tenant_id = $4
         RETURNING *`,
        [normalized, user.id, orderId, user.tenant_id, normalized === "cancelled"]
    );

    await pool.query(
        `INSERT INTO order_status_history (
            id, order_id, tenant_id, from_status, to_status, reason, changed_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
        [uuidv4(), orderId, user.tenant_id, fromStatus, normalized, reason, user.id]
    );

    if (normalized === "shipped" || normalized === "delivered") {
        const currentDelivery = await pool.query(
            `SELECT id FROM order_deliveries WHERE order_id = $1 LIMIT 1`,
            [orderId]
        );
        if (currentDelivery.rowCount === 0) {
            await pool.query(
                `INSERT INTO order_deliveries (id, order_id, tenant_id, warehouse_id, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, now(), now())`,
                [uuidv4(), orderId, user.tenant_id, order.warehouse_id]
            );
        }
        if (normalized === "shipped") {
            await pool.query(
                `UPDATE order_deliveries SET dispatched_at = coalesce(dispatched_at, now()), updated_at = now() WHERE order_id = $1`,
                [orderId]
            );
        }
        if (normalized === "delivered") {
            await pool.query(
                `UPDATE order_deliveries SET delivered_at = coalesce(delivered_at, now()), updated_at = now() WHERE order_id = $1`,
                [orderId]
            );
        }
    }

    const customerResult = await pool.query(
        `SELECT cp.user_id, o.order_number
         FROM orders o
         LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
         WHERE o.id = $1 AND o.tenant_id = $2
         LIMIT 1`,
        [orderId, user.tenant_id]
    );
    const customerUserId = customerResult.rows[0]?.user_id ?? null;
    const orderNumber = customerResult.rows[0]?.order_number ?? "Order";

    await createNotificationService({
        tenant_id: user.tenant_id,
        user_id: customerUserId,
        type: "order_status",
        title: `Order ${orderNumber} updated`,
        message: `Status changed to ${normalized}.`,
        mobile_screen: "OrderDetails",
        mobile_params: { order_id: orderId, status: normalized },
    }).catch(() => null);

    void sendCustomerOrderStatusFcm({
        tenantId: user.tenant_id,
        customerUserId,
        orderId,
        orderNumber,
        status: normalized,
    });

    return result.rows[0] ?? null;
};

export const getOrderStatusHistoryService = async (user, orderId) => {
    const order = await getOrderByIdService(user, orderId);
    if (!order) return null;
    return Array.isArray(order.history) ? order.history : [];
};

export const getOrderDeliveryService = async (user, orderId) => {
    const order = await getOrderByIdService(user, orderId);
    if (!order) return null;
    return order.delivery ?? null;
};

export const upsertOrderDeliveryService = async (user, orderId, payload = {}) => {
    const order = await getOrderByIdService(user, orderId);
    if (!order) return null;
    if (normalizeStatus(order.fulfillment_type) !== "delivery") {
        throw new Error("Delivery details are only allowed for delivery orders.");
    }

    const existing = await pool.query(
        `SELECT id FROM order_deliveries WHERE order_id = $1 LIMIT 1`,
        [orderId]
    );
    const {
        courier_name,
        courier_phone,
        tracking_number,
        dispatch_note,
        delivery_note,
        dispatched_at,
        delivered_at,
    } = payload;

    if (!existing.rowCount) {
        await pool.query(
            `INSERT INTO order_deliveries (
                id, order_id, tenant_id, warehouse_id, courier_name, courier_phone, tracking_number,
                dispatch_note, delivery_note, dispatched_at, delivered_at, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, now(), now()
            )`,
            [
                uuidv4(),
                orderId,
                user.tenant_id,
                order.warehouse_id,
                courier_name || null,
                courier_phone || null,
                tracking_number || null,
                dispatch_note || null,
                delivery_note || null,
                dispatched_at || null,
                delivered_at || null,
            ]
        );
    } else {
        await pool.query(
            `UPDATE order_deliveries
             SET courier_name = $1,
                 courier_phone = $2,
                 tracking_number = $3,
                 dispatch_note = $4,
                 delivery_note = $5,
                 dispatched_at = $6,
                 delivered_at = $7,
                 updated_at = now()
             WHERE order_id = $8`,
            [
                courier_name || null,
                courier_phone || null,
                tracking_number || null,
                dispatch_note || null,
                delivery_note || null,
                dispatched_at || null,
                delivered_at || null,
                orderId,
            ]
        );
    }

    return getOrderDeliveryService(user, orderId);
};

export const initiateOrderPaymentService = async (user, orderId, body = {}) => {
    const { payment_method, phone, provider, callback_url, email } = body;

    const order = await getOrderByIdService(user, orderId);
    if (!order) throw new Error("Order not found.");

    const profile = await getCustomerProfileForUser(user);
    if (!profile || order.customer_profile_id !== profile.id) {
        throw new Error("Only the customer who placed this order can pay.");
    }

    if (normalizeStatus(order.status) !== "confirmed") {
        throw new Error("Payment is available after the store confirms your order.");
    }

    if (isInstallmentOrder(order)) {
        throw new Error("Use partial payment for pay-over-time orders.");
    }

    const payStatus = normalizePaymentStatus(order.payment_status);
    if (payStatus === "paid") {
        throw new Error("This order is already paid.");
    }
    if (!["unpaid", "failed", "pending"].includes(payStatus)) {
        throw new Error("Payment cannot be started for this order.");
    }

    const amount = Number(order.total_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid order total for payment.");
    }

    const payment_method_type = payment_method === "mobile_money" ? "mobile_money" : "card";
    if (payment_method_type === "mobile_money") {
        if (!phone || !provider) {
            throw new Error("For mobile money, phone and provider (e.g. mtn, tgo, vod) are required.");
        }
    }

    const { id: payment_id, transaction_ref } = await createPendingPaymentForCheckoutService({
        amount,
        subscription_id: null,
        customer_id: null,
        order_id: orderId,
        tenant_id: user.tenant_id,
        creator_id: user.id,
        payment_method_type,
    });

    await pool.query(
        `UPDATE orders SET payment_status = 'pending', updated_at = now() WHERE id = $1 AND tenant_id = $2`,
        [orderId, user.tenant_id]
    );

    const payload = {
        amount,
        email: email || user.email || "customer@example.com",
        reference: transaction_ref,
        callback_url: callback_url || undefined,
        payment_method: payment_method_type,
        metadata: { payment_id, tenant_id: user.tenant_id, order_id: orderId },
        phone,
        provider,
    };

    const result = await initiateCheckout(payload);

    if (payment_method_type === "mobile_money") {
        return {
            transaction_ref: result.reference,
            payment_id,
            status: result.status,
            display_text: result.display_text ?? undefined,
            ussd_code: result.ussd_code ?? undefined,
        };
    }
    return {
        redirect_url: result.redirect_url,
        transaction_ref: result.reference,
        payment_id,
    };
};

export const submitOrderPaymentOtpService = async (user, orderId, reference, otp) => {
    if (!reference || !otp) throw new Error("reference and otp are required.");

    const order = await getOrderByIdService(user, orderId);
    if (!order) throw new Error("Order not found.");

    const profile = await getCustomerProfileForUser(user);
    if (!profile || order.customer_profile_id !== profile.id) {
        throw new Error("Only the customer who placed this order can complete payment.");
    }

    const payment = await getPaymentByTransactionRefService(reference, user.tenant_id);
    if (!payment || payment.order_id !== orderId) {
        throw new Error("Invalid payment reference for this order.");
    }

    const result = await submitChargeOtp(reference, String(otp).trim());
    if (result.status === "success") {
        await updatePaymentStatusByTransactionRefService(reference, "success");
        await syncOrderPaymentAfterSuccess(reference, user.tenant_id);
    }
    return {
        transaction_ref: result.reference,
        status: result.status,
        display_text: result.display_text ?? undefined,
    };
};

export const markOrderPaidCashService = async (user, orderId, payload = {}) => {
    const order = await getOrderByIdService(user, orderId);
    if (!order) return null;

    if (isInstallmentOrder(order) && toMoney(order.balance_due) > 0) {
        throw new Error("Use partial cash payment recording for pay-over-time orders with a balance.");
    }

    const currentPaymentStatus = normalizePaymentStatus(order.payment_status);
    if (currentPaymentStatus === "paid") {
        throw new Error("Order is already marked as paid.");
    }

    const status = normalizeStatus(order.status);
    const fulfillment = normalizeStatus(order.fulfillment_type || "pickup");
    const pickupDone = fulfillment === "pickup" && status === "completed";
    const deliveryDone = fulfillment === "delivery" && (status === "delivered" || status === "completed");
    if (!pickupDone && !deliveryDone) {
        throw new Error("Cash payment can only be marked after pickup/delivery is completed.");
    }

    const amount = Number(order.total_amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Order total is invalid for cash payment.");
    }

    const note = payload?.note != null ? String(payload.note).trim() : "";
    const payment = await createPaymentService({
        amount,
        subscription_id: null,
        customer_id: null,
        order_id: orderId,
        tenant_id: user.tenant_id,
        creator_id: user.id,
        payment_method_type: "cash",
        transaction_ref: null,
        payment_number: null,
        status: "success",
    });

    const updated = await pool.query(
        `UPDATE orders
         SET payment_status = 'paid',
             updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [orderId, user.tenant_id]
    );

    if (note) {
        await pool.query(
            `INSERT INTO order_status_history (
                id, order_id, tenant_id, from_status, to_status, reason, changed_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
            [uuidv4(), orderId, user.tenant_id, status, status, `Cash payment marked paid: ${note}`, user.id]
        );
    }

    await logPaymentEventService({
        payment_id: payment?.id,
        order_id: orderId,
        tenant_id: user.tenant_id,
        actor_user_id: user.id,
        event_type: "cash_payment_marked_paid",
        note: note ? `Cash payment marked paid: ${note}` : "Cash payment marked paid by staff.",
        metadata: { order_status: status, fulfillment_type: fulfillment },
    }).catch(() => null);

    const customerResult = await pool.query(
        `SELECT cp.user_id, o.order_number
         FROM orders o
         LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
         WHERE o.id = $1 AND o.tenant_id = $2
         LIMIT 1`,
        [orderId, user.tenant_id]
    );
    const customerUserId = customerResult.rows[0]?.user_id ?? null;
    const orderNumber = customerResult.rows[0]?.order_number ?? "Order";
    await createNotificationService({
        tenant_id: user.tenant_id,
        user_id: customerUserId,
        type: "order_payment_paid",
        title: `Payment recorded for ${orderNumber}`,
        message: "Cash payment has been marked as paid by store staff.",
        mobile_screen: "MyOrderDetails",
        mobile_params: { order_id: orderId, payment_status: "paid" },
    }).catch(() => null);

    return updated.rows[0] ?? null;
};

const assertCustomerCanPayInstallment = async (user, order) => {
    const profile = await getCustomerProfileForUser(user);
    if (!profile || order.customer_profile_id !== profile.id) {
        throw new Error("Only the customer who placed this order can pay.");
    }
    if (normalizeStatus(order.status) !== "confirmed") {
        throw new Error("Payment is available after the store confirms your order.");
    }
    if (!isInstallmentOrder(order)) {
        throw new Error("This order is not on pay-over-time.");
    }
    if (toMoney(order.balance_due) <= 0) {
        throw new Error("This order is already fully paid.");
    }
};

export const initiatePartialOrderPaymentService = async (user, orderId, body = {}) => {
    const { amount, payment_method, phone, provider, callback_url, email } = body;
    const order = await getOrderByIdService(user, orderId);
    if (!order) throw new Error("Order not found.");

    await assertCustomerCanPayInstallment(user, order);

    const productIds = (order.items || []).map((i) => i.product_id).filter(Boolean);
    const products = await loadProductsForInstallmentCheck(
        user.tenant_id,
        order.warehouse_id,
        productIds
    );
    const minPartial = resolveMinPartialPayment(products);
    const payAmount = validatePartialPaymentAmount(amount, order.balance_due, minPartial);

    const payment_method_type = payment_method === "mobile_money" ? "mobile_money" : "card";
    if (payment_method_type === "mobile_money") {
        if (!phone || !provider) {
            throw new Error("For mobile money, phone and provider (e.g. mtn, tgo, vod) are required.");
        }
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const { id: payment_id, transaction_ref } = await createPendingPaymentForCheckoutService({
            amount: payAmount,
            subscription_id: null,
            customer_id: null,
            order_id: orderId,
            tenant_id: user.tenant_id,
            creator_id: user.id,
            payment_method_type,
        });

        const ledgerId = await createInstallmentLedgerRow(client, {
            order_id: orderId,
            tenant_id: user.tenant_id,
            amount: payAmount,
            payment_method: payment_method_type,
            status: "pending",
            payments_id: payment_id,
        });

        await client.query(
            `UPDATE orders SET payment_status = 'pending', updated_at = now() WHERE id = $1 AND tenant_id = $2`,
            [orderId, user.tenant_id]
        );

        await client.query("COMMIT");

        const payload = {
            amount: payAmount,
            email: email || user.email || "customer@example.com",
            reference: transaction_ref,
            callback_url: callback_url || undefined,
            payment_method: payment_method_type,
            metadata: {
                payment_id,
                tenant_id: user.tenant_id,
                order_id: orderId,
                installment_ledger_id: ledgerId,
            },
            phone,
            provider,
        };

        const result = await initiateCheckout(payload);

        if (payment_method_type === "mobile_money") {
            return {
                transaction_ref: result.reference,
                payment_id,
                installment_ledger_id: ledgerId,
                amount: payAmount,
                balance_after: toMoney(order.balance_due - payAmount),
                status: result.status,
                display_text: result.display_text ?? undefined,
                ussd_code: result.ussd_code ?? undefined,
            };
        }
        return {
            redirect_url: result.redirect_url,
            transaction_ref: result.reference,
            payment_id,
            installment_ledger_id: ledgerId,
            amount: payAmount,
            balance_after: toMoney(order.balance_due - payAmount),
        };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

export const recordPartialCashForOrderService = async (user, orderId, body = {}) => {
    const order = await getOrderByIdService(user, orderId);
    if (!order) return null;

    if (!isInstallmentOrder(order)) {
        throw new Error("Partial cash recording is only for pay-over-time orders.");
    }
    if (toMoney(order.balance_due) <= 0) {
        throw new Error("Order balance is already zero.");
    }

    const productIds = (order.items || []).map((i) => i.product_id).filter(Boolean);
    const products = await loadProductsForInstallmentCheck(
        user.tenant_id,
        order.warehouse_id,
        productIds
    );
    const minPartial = resolveMinPartialPayment(products);
    const payAmount = validatePartialPaymentAmount(body?.amount, order.balance_due, minPartial);
    const note = body?.note != null ? String(body.note).trim() : "";

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const payment = await createPaymentService({
            amount: payAmount,
            subscription_id: null,
            customer_id: null,
            order_id: orderId,
            tenant_id: user.tenant_id,
            creator_id: user.id,
            payment_method_type: "cash",
            transaction_ref: null,
            payment_number: null,
            status: "success",
        });

        await createInstallmentLedgerRow(client, {
            order_id: orderId,
            tenant_id: user.tenant_id,
            amount: payAmount,
            payment_method: "cash",
            status: "completed",
            payments_id: payment?.id,
            recorded_by: user.id,
            note: note || "Cash partial payment",
        });

        const { order: updated, fullyPaid } = await applyOrderPartialPayment(
            client,
            orderId,
            user.tenant_id,
            payAmount
        );

        await client.query("COMMIT");

        await logPaymentEventService({
            payment_id: payment?.id,
            order_id: orderId,
            tenant_id: user.tenant_id,
            actor_user_id: user.id,
            event_type: "installment_cash_payment",
            note: note || "Partial cash payment recorded.",
            metadata: { amount: payAmount, fully_paid: fullyPaid },
        }).catch(() => null);

        const ledger = await getInstallmentPaymentsForOrder(orderId, user.tenant_id);
        return enrichOrderInstallmentFields(updated, ledger);
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};
