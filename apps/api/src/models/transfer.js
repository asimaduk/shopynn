import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';

const TRANSFER_STATUS = {
    PENDING: 'pending',
    RECEIVED: 'received',
};

function toQty(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
}

function statusError(message, code, status = 400) {
    const err = new Error(message);
    err.status = status;
    err.code = code;
    return err;
}

export const getAllTransfersService = async (user, requestQuery = {}) => {
    const conditions = ["transfers.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`transfers.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const status = requestQuery.status;
    if (status && String(status).trim()) {
        conditions.push(`transfers.status = $${paramIndex}`);
        params.push(String(status).trim().toLowerCase());
        paramIndex += 1;
    }

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        conditions.push(`transfers.notes ILIKE $${paramIndex}`);
        params.push(`%${String(search).trim()}%`);
        paramIndex += 1;
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT 
            transfers.*,
            sw.name AS source_warehouse_name,
            dw.name AS destination_warehouse_name,
            cu.first_name AS creator_first_name,
            cu.last_name AS creator_last_name,
            ru.first_name AS receiver_first_name,
            ru.last_name AS receiver_last_name
        FROM transfers
        LEFT JOIN warehouses sw ON transfers.source_warehouse_id = sw.id
        LEFT JOIN warehouses dw ON transfers.destination_warehouse_id = dw.id
        LEFT JOIN users cu ON transfers.creator_id = cu.id
        LEFT JOIN users ru ON transfers.receiver_id = ru.id
        WHERE ${where}
        ORDER BY transfers.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
        ...row,
        status_label:
            row.status === TRANSFER_STATUS.RECEIVED
                ? 'Received'
                : row.status === TRANSFER_STATUS.PENDING
                  ? 'Pending'
                  : row.status,
    }));
};

/**
 * Transfers summary for a tenant over a date range.
 */
export const getTransfersSummaryService = async (user, requestQuery = {}) => {
    const { tenant_id } = user;

    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const startDate =
        requestQuery.startDate ||
        requestQuery.from ||
        defaultStart.toISOString().slice(0, 10);
    const endDate =
        requestQuery.endDate ||
        requestQuery.to ||
        today.toISOString().slice(0, 10);

    const conditions = ["t.tenant_id = $1", "t.created_at BETWEEN $2 AND $3"];
    const params = [tenant_id, startDate, endDate];
    let paramIndex = 4;

    const sourceWarehouseId =
        requestQuery.sourceWarehouseId ?? requestQuery.source_warehouse_id;
    if (sourceWarehouseId) {
        conditions.push(`t.source_warehouse_id = $${paramIndex}`);
        params.push(sourceWarehouseId);
        paramIndex++;
    }

    const destinationWarehouseId =
        requestQuery.destinationWarehouseId ?? requestQuery.destination_warehouse_id;
    if (destinationWarehouseId) {
        conditions.push(`t.destination_warehouse_id = $${paramIndex}`);
        params.push(destinationWarehouseId);
        paramIndex++;
    }

    const productId = requestQuery.productId ?? requestQuery.product_id;
    if (productId) {
        conditions.push(`td.product_id = $${paramIndex}`);
        params.push(productId);
        paramIndex++;
    }

    const where = conditions.join(" AND ");

    const summaryQuery = `
        SELECT
            COUNT(DISTINCT t.id)::int AS transfer_count,
            COALESCE(SUM(t.number_of_items), 0)::int AS total_items,
            COALESCE(SUM(td.quantity), 0)::int AS total_units_moved
        FROM transfers t
        LEFT JOIN transferdetails td ON td.transfer_id = t.id
        WHERE ${where}
    `;
    const summaryResult = await pool.query(summaryQuery, params);
    const summaryRow = summaryResult.rows[0] || {
        transfer_count: 0,
        total_items: 0,
        total_units_moved: 0,
    };

    const listQuery = `
        SELECT
            td.id,
            td.transfer_id,
            td.product_id,
            p.name AS product_name,
            td.quantity,
            td.quantity_received,
            t.sent_date,
            t.received_date,
            t.status,
            t.created_at,
            t.source_warehouse_id,
            sw.name AS source_warehouse_name,
            t.destination_warehouse_id,
            dw.name AS destination_warehouse_name
        FROM transfers t
        JOIN transferdetails td ON td.transfer_id = t.id
        LEFT JOIN products p ON p.id = td.product_id
        LEFT JOIN warehouses sw ON sw.id = t.source_warehouse_id
        LEFT JOIN warehouses dw ON dw.id = t.destination_warehouse_id
        WHERE ${where}
        ORDER BY t.created_at DESC, p.name ASC
    `;
    const listResult = await pool.query(listQuery, params);

    return {
        startDate,
        endDate,
        transferCount: Number(summaryRow.transfer_count || 0),
        totalItems: Number(summaryRow.total_items || 0),
        totalUnitsMoved: Number(summaryRow.total_units_moved || 0),
        movements: listResult.rows.map((row) => ({
            movement_id: row.id,
            transfer_id: row.transfer_id,
            reference: row.transfer_id,
            product_id: row.product_id,
            product_name: row.product_name,
            quantity: Number(row.quantity || 0),
            quantity_received:
                row.quantity_received != null ? Number(row.quantity_received) : null,
            sent_date: row.sent_date,
            received_date: row.received_date,
            status: row.status,
            created_at: row.created_at,
            source_warehouse_id: row.source_warehouse_id,
            source_warehouse_name: row.source_warehouse_name,
            destination_warehouse_id: row.destination_warehouse_id,
            destination_warehouse_name: row.destination_warehouse_name,
        })),
    };
};

export const getTransferByIdService = async (id) => {
    const result = await pool.query("SELECT * FROM transfers where id = $1", [id]);
    return result.rows[0];
};

export const getTransferDetailsByIdService = async (user, id) => {
    const transferResult = await pool.query(
        `SELECT 
            trn.id,
            trn.notes,
            trn.number_of_items,
            trn.status,
            trn.sent_date,
            trn.received_date,
            trn.created_at,
            trn.source_warehouse_id,
            trn.destination_warehouse_id,
            trn.creator_id,
            trn.receiver_id,
            sw.name AS source_warehouse_name,
            dw.name AS destination_warehouse_name,
            cu.first_name AS creator_first_name,
            cu.last_name AS creator_last_name,
            ru.first_name AS receiver_first_name,
            ru.last_name AS receiver_last_name
         FROM transfers trn
         LEFT JOIN warehouses sw ON trn.source_warehouse_id = sw.id
         LEFT JOIN warehouses dw ON trn.destination_warehouse_id = dw.id
         LEFT JOIN users cu ON trn.creator_id = cu.id
         LEFT JOIN users ru ON trn.receiver_id = ru.id
         WHERE trn.tenant_id = $1
           AND trn.id = $2
         LIMIT 1`,
        [user.tenant_id, id]
    );

    if (!transferResult.rowCount) {
        return null;
    }

    const transfer = transferResult.rows[0];

    const productsResult = await pool.query(
        `SELECT 
            td.id AS detail_id,
            td.product_id,
            td.quantity,
            td.quantity_received,
            td.created_at,
            p.name AS product_name,
            p.thumbnail
         FROM transferdetails td
         LEFT JOIN products p ON td.product_id = p.id
         WHERE td.transfer_id = $1
         ORDER BY p.name ASC`,
        [id]
    );

    return {
        ...transfer,
        status_label:
            transfer.status === TRANSFER_STATUS.RECEIVED
                ? 'Received'
                : transfer.status === TRANSFER_STATUS.PENDING
                  ? 'Pending'
                  : transfer.status,
        products: productsResult.rows || [],
        items: productsResult.rows || [],
    };
};

/**
 * Create/send transfer: deduct source only; status = pending until destination receives.
 */
export const createTransferService = async (payload) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const {
            sent_date,
            source_warehouse_id,
            destination_warehouse_id,
            tenant_id,
            creator_id,
            products,
            notes,
            note,
        } = payload;

        if (!products || !products.length) {
            throw statusError('Products list cannot be empty.', 'TRANSFER_EMPTY');
        }
        if (!source_warehouse_id || !destination_warehouse_id) {
            throw statusError('Source and destination warehouses are required.', 'TRANSFER_WAREHOUSES_REQUIRED');
        }
        if (String(source_warehouse_id) === String(destination_warehouse_id)) {
            throw statusError('Source and destination must be different.', 'TRANSFER_SAME_WAREHOUSE');
        }
        if (!tenant_id) {
            throw statusError('tenant_id is required.', 'TENANT_REQUIRED');
        }

        const id = uuidv4();
        const numberOfItems = products.reduce((acc, prod) => acc + toQty(prod.quantity), 0);
        const transferNotes = notes ?? note ?? null;

        const result = await client.query(
            `INSERT INTO transfers (
                id, sent_date, number_of_items, source_warehouse_id, destination_warehouse_id,
                tenant_id, creator_id, notes, status, created_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                id,
                sent_date ? new Date(sent_date) : new Date(),
                numberOfItems,
                source_warehouse_id,
                destination_warehouse_id,
                tenant_id,
                creator_id,
                transferNotes,
                TRANSFER_STATUS.PENDING,
                new Date(),
            ]
        );

        for (const prod of products) {
            const qty = toQty(prod.quantity);
            if (qty <= 0) {
                throw statusError('Each line quantity must be greater than zero.', 'TRANSFER_INVALID_QTY');
            }

            const r1 = await client.query(
                `SELECT id, quantity_available FROM inventories
                 WHERE product_id = $1 AND warehouse_id = $2
                 FOR UPDATE`,
                [prod.id, source_warehouse_id]
            );
            if (!r1.rowCount) {
                throw statusError(
                    `No inventory at source for product ${prod.name || prod.id}.`,
                    'TRANSFER_SOURCE_STOCK_MISSING'
                );
            }
            const available = Number(r1.rows[0].quantity_available || 0);
            if (available + 1e-9 < qty) {
                throw statusError(
                    `Insufficient stock at source for ${prod.name || prod.id} (have ${available}, need ${qty}).`,
                    'TRANSFER_INSUFFICIENT_STOCK'
                );
            }

            await client.query(
                `UPDATE inventories SET quantity_available = quantity_available - $1, updated_at = $2
                 WHERE id = $3`,
                [qty, new Date(), r1.rows[0].id]
            );

            const detailId = uuidv4();
            await client.query(
                `INSERT INTO transferdetails (id, transfer_id, product_id, quantity, tenant_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [detailId, id, prod.id, qty, tenant_id, new Date()]
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
};

/**
 * Destination accepts transfer.
 * Body: { all_received: true } OR { lines: [{ product_id|detail_id, quantity_received }] }
 */
export const receiveTransferService = async (user, transferId, body = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const transferRes = await client.query(
            `SELECT * FROM transfers WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
            [transferId, user.tenant_id]
        );
        const transfer = transferRes.rows[0];
        if (!transfer) {
            throw statusError('Transfer not found.', 'TRANSFER_NOT_FOUND', 404);
        }
        if (transfer.status === TRANSFER_STATUS.RECEIVED) {
            throw statusError('This transfer was already received.', 'TRANSFER_ALREADY_RECEIVED');
        }
        if (transfer.status && transfer.status !== TRANSFER_STATUS.PENDING) {
            throw statusError(`Cannot receive transfer in status "${transfer.status}".`, 'TRANSFER_BAD_STATUS');
        }

        const detailsRes = await client.query(
            `SELECT id, product_id, quantity, quantity_received
             FROM transferdetails WHERE transfer_id = $1 FOR UPDATE`,
            [transferId]
        );
        if (!detailsRes.rowCount) {
            throw statusError('Transfer has no line items.', 'TRANSFER_EMPTY');
        }

        const allReceived = body.all_received === true || body.allReceived === true;
        const linesInput = Array.isArray(body.lines) ? body.lines : [];

        const receivedByDetail = new Map();
        if (allReceived) {
            for (const d of detailsRes.rows) {
                receivedByDetail.set(String(d.id), toQty(d.quantity));
            }
        } else {
            if (!linesInput.length) {
                throw statusError(
                    'Provide all_received=true or lines with quantity_received.',
                    'TRANSFER_RECEIVE_LINES_REQUIRED'
                );
            }
            for (const line of linesInput) {
                const detail =
                    detailsRes.rows.find((d) => String(d.id) === String(line.detail_id || line.id)) ||
                    detailsRes.rows.find((d) => String(d.product_id) === String(line.product_id));
                if (!detail) {
                    throw statusError(
                        `Unknown transfer line for product ${line.product_id || line.detail_id}.`,
                        'TRANSFER_LINE_NOT_FOUND'
                    );
                }
                const got = toQty(line.quantity_received ?? line.received_quantity ?? line.qty);
                if (got > toQty(detail.quantity) + 1e-9) {
                    throw statusError(
                        `Received qty cannot exceed sent qty for a line (sent ${detail.quantity}).`,
                        'TRANSFER_RECEIVE_EXCEEDS_SENT'
                    );
                }
                receivedByDetail.set(String(detail.id), got);
            }
            for (const d of detailsRes.rows) {
                if (!receivedByDetail.has(String(d.id))) {
                    throw statusError(
                        'Every transfer line needs a received quantity (or use all_received).',
                        'TRANSFER_RECEIVE_INCOMPLETE'
                    );
                }
            }
        }

        const destId = transfer.destination_warehouse_id;
        const now = new Date();

        for (const d of detailsRes.rows) {
            const got = receivedByDetail.get(String(d.id)) ?? 0;

            await client.query(
                `UPDATE transferdetails
                 SET quantity_received = $1, updated_at = $2
                 WHERE id = $3`,
                [got, now, d.id]
            );

            if (got <= 0) continue;

            const invRes = await client.query(
                `SELECT id FROM inventories
                 WHERE product_id = $1 AND warehouse_id = $2
                 FOR UPDATE`,
                [d.product_id, destId]
            );
            if (invRes.rowCount) {
                await client.query(
                    `UPDATE inventories
                     SET quantity_available = quantity_available + $1, updated_at = $2
                     WHERE id = $3`,
                    [got, now, invRes.rows[0].id]
                );
            } else {
                const newId = uuidv4();
                await client.query(
                    `INSERT INTO inventories (
                        id, quantity_available, minimum_stock_level, product_id, warehouse_id,
                        creator_id, tenant_id, created_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [newId, got, 10, d.product_id, destId, user.id, user.tenant_id, now]
                );
            }
        }

        const upd = await client.query(
            `UPDATE transfers
             SET status = $1,
                 receiver_id = $2,
                 received_date = $3,
                 updated_at = $3
             WHERE id = $4 AND tenant_id = $5
             RETURNING *`,
            [TRANSFER_STATUS.RECEIVED, user.id, now, transferId, user.tenant_id]
        );

        await client.query('COMMIT');

        const shortfalls = detailsRes.rows
            .map((d) => {
                const sent = toQty(d.quantity);
                const got = receivedByDetail.get(String(d.id)) ?? 0;
                return { product_id: d.product_id, sent, received: got, shortfall: Math.max(0, sent - got) };
            })
            .filter((x) => x.shortfall > 0);

        return {
            ...upd.rows[0],
            shortfalls,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const updateTransferService = async (payload) => {
    const { id, name, source_warehouse_id, destination_warehouse_id, received_date } = payload;
    const result = await pool.query(
        `UPDATE transfers SET name=$1, source_warehouse_id=$2, destination_warehouse_id=$3, received_date=$4, updated_at=$5 WHERE id=$6 RETURNING *`,
        [name, source_warehouse_id, destination_warehouse_id, new Date(received_date), new Date(), id]
    );

    return result.rows[0];
};

export const deleteTransferService = async (id) => {
    const result = await pool.query(
        `UPDATE transfers SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
        [false, new Date(), id]
    );

    return result.rows[0];
};

export const getAllTransferDetailsService = async () => {
    const result = await pool.query('SELECT * FROM transferdetails');
    return result.rows;
};

export { TRANSFER_STATUS };
