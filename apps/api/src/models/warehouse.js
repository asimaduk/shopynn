import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { checkTenantCanAddWarehouse } from "./subscription.js";
import {
    normalizeReferenceCode,
    generateWarehouseReferenceCode,
    REFERENCE_CODE_VALIDATION_MESSAGE,
} from "../constants/referenceCode.js";

const ALLOWED_PRINTER_TYPES = new Set(['thermal', 'a4', 'any']);

export { generateWarehouseReferenceCode };

async function upsertWarehouseReferenceCode({ warehouse_id, tenant_id, reference_code }) {
    if (!warehouse_id || !tenant_id) return null;

    const rawProvided = reference_code != null && String(reference_code).trim() !== '';
    const code = rawProvided ? normalizeReferenceCode(reference_code) : '';
    if (rawProvided && !code) {
        return { message: `Invalid customer signup code. ${REFERENCE_CODE_VALIDATION_MESSAGE}` };
    }

    const existingRes = await pool.query(
        `SELECT id, reference_code
         FROM warehouse_reference_codes
         WHERE warehouse_id = $1 AND tenant_id = $2
         ORDER BY coalesce(is_active, true) DESC, updated_at DESC NULLS LAST
         LIMIT 1`,
        [warehouse_id, tenant_id]
    );

    if (!code) {
        if (existingRes.rowCount > 0) {
            await pool.query(
                `UPDATE warehouse_reference_codes
                 SET is_active = false, updated_at = $2
                 WHERE warehouse_id = $1 AND tenant_id = $3`,
                [warehouse_id, new Date(), tenant_id]
            );
        }
        return null;
    }

    const dupRes = await pool.query(
        `SELECT w.id
         FROM warehouse_reference_codes wrc
         INNER JOIN warehouses w ON w.id = wrc.warehouse_id
         WHERE wrc.tenant_id = $1
           AND lower(wrc.reference_code) = lower($2)
           AND wrc.warehouse_id <> $3
           AND coalesce(wrc.is_active, true) = true
         LIMIT 1`,
        [tenant_id, code, warehouse_id]
    );
    if (dupRes.rowCount > 0) {
        return { message: 'This customer signup code is already used by another store.' };
    }

    const now = new Date();
    if (existingRes.rowCount > 0) {
        await pool.query(
            `UPDATE warehouse_reference_codes
             SET reference_code = $1, is_active = true, updated_at = $2
             WHERE id = $3`,
            [code, now, existingRes.rows[0].id]
        );
        return { reference_code: code };
    }

    await pool.query(
        `INSERT INTO warehouse_reference_codes (id, warehouse_id, tenant_id, reference_code, created_at, updated_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $5, true)`,
        [uuidv4(), warehouse_id, tenant_id, code, now]
    );
    return { reference_code: code };
}

function normalizePrinterType(value) {
    const s = (value != null && String(value).trim() !== '' ? String(value) : 'any').toLowerCase();
    return ALLOWED_PRINTER_TYPES.has(s) ? s : 'any';
}

export const getAllWarehousesService = async (user, requestQuery = {}) => {
    const conditions = ["warehouses.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    const nameSearch = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (nameSearch && String(nameSearch).trim()) {
        conditions.push(`warehouses.name ILIKE $${paramIndex}`);
        params.push(`%${String(nameSearch).trim()}%`);
    }

    const where = conditions.join(" AND ");
    const query = `SELECT warehouses.id, warehouses.name, warehouses.manager, warehouses.phone, warehouses.address, warehouses.printer_type, warehouses.minimum_order_amount, warehouses.created_at, locations.name AS location,
        (
            SELECT wrc.reference_code
            FROM warehouse_reference_codes wrc
            WHERE wrc.warehouse_id = warehouses.id
              AND wrc.tenant_id = warehouses.tenant_id
              AND coalesce(wrc.is_active, true) = true
            ORDER BY wrc.updated_at DESC NULLS LAST, wrc.created_at DESC
            LIMIT 1
        ) AS reference_code
        FROM warehouses
        LEFT JOIN locations ON warehouses.location_id = locations.id
        WHERE ${where}
        ORDER BY warehouses.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
}

export const getWarehouseByIdService = async (id) => {
    //SELECT id, name, manager, phone, address, created_at FROM warehouses where id = $1", [id]
    const result = await pool.query(
        `SELECT warehouses.id, warehouses.name, warehouses.manager, warehouses.phone, warehouses.address, warehouses.printer_type, warehouses.minimum_order_amount, warehouses.created_at, warehouses.notes, warehouses.location_id, warehouses.tenant_id, locations.name AS location,
            (
                SELECT wrc.reference_code
                FROM warehouse_reference_codes wrc
                WHERE wrc.warehouse_id = warehouses.id
                  AND wrc.tenant_id = warehouses.tenant_id
                  AND coalesce(wrc.is_active, true) = true
                ORDER BY wrc.updated_at DESC NULLS LAST, wrc.created_at DESC
                LIMIT 1
            ) AS reference_code
         FROM warehouses
         LEFT JOIN locations ON warehouses.location_id = locations.id
         WHERE warehouses.id = $1`,
        [id]
    );

    return result.rows[0];
}

export const createWarehouseService = async (payload, options = {}) => {
    const { allowReferenceCodes = false } = options;
    const {
        name,
        manager,
        phone,
        tenant_id,
        address,
        is_refrigerated,
        location_id,
        creator_id,
        printer_type,
        minimum_order_amount,
        reference_code,
    } = payload;
    if (!tenant_id) {
        return { message: "tenant_id is required." };
    }
    const cap = await checkTenantCanAddWarehouse(tenant_id);
    if (!cap.ok) {
        return { message: cap.message };
    }
    const printerType = normalizePrinterType(printer_type);
    const minOrder = Number(minimum_order_amount);
    const minOrderNorm = Number.isFinite(minOrder) && minOrder >= 0 ? minOrder : 0;
    const id = uuidv4();
    const result = await pool.query(`
        INSERT INTO warehouses (id, name, manager, phone, tenant_id, address, is_refrigerated, location_id, creator_id, printer_type, minimum_order_amount, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [id, name, manager, phone, tenant_id, address, is_refrigerated, location_id, creator_id, printerType, minOrderNorm, new Date(), new Date()]
    );

    const row = result.rows[0];
    if (!row?.id) return row;

    if (!allowReferenceCodes) {
        return row;
    }

    const codeToSave =
        reference_code != null && String(reference_code).trim() !== ''
            ? reference_code
            : generateWarehouseReferenceCode(name);
    const refResult = await upsertWarehouseReferenceCode({
        warehouse_id: row.id,
        tenant_id,
        reference_code: codeToSave,
    });
    if (refResult?.message) {
        await pool.query(`DELETE FROM warehouses WHERE id = $1`, [row.id]);
        return { message: refResult.message };
    }
    return { ...row, reference_code: refResult?.reference_code ?? null };
}

export const updateWarehouseService = async (payload, options = {}) => {
    const { allowReferenceCodes = false } = options;
    const { id, name, manager, phone, address, notes, location_id, printer_type, minimum_order_amount, reference_code, tenant_id } = payload;

    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (manager !== undefined) { updates.push(`manager = $${i++}`); values.push(manager); }
    if (phone !== undefined) { updates.push(`phone = $${i++}`); values.push(phone); }
    if (address !== undefined) { updates.push(`address = $${i++}`); values.push(address); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); values.push(notes); }
    if (location_id !== undefined) { updates.push(`location_id = $${i++}`); values.push(location_id); }
    if (printer_type !== undefined) { updates.push(`printer_type = $${i++}`); values.push(normalizePrinterType(printer_type)); }
    if (minimum_order_amount !== undefined) {
        const m = Number(minimum_order_amount);
        updates.push(`minimum_order_amount = $${i++}`);
        values.push(Number.isFinite(m) && m >= 0 ? m : 0);
    }

    const hasReferenceUpdate = allowReferenceCodes && reference_code !== undefined;
    if (updates.length === 0 && !hasReferenceUpdate) return null;

    let updatedRow = { id };
    if (updates.length > 0) {
        updates.push(`updated_at = $${i++}`);
        values.push(new Date(), id);

        const result = await pool.query(
            `UPDATE warehouses SET ${updates.join(", ")} WHERE id = $${i} RETURNING id, tenant_id`,
            values
        );
        updatedRow = result.rows[0] || null;
        if (!updatedRow) return null;
    } else {
        const whRes = await pool.query(`SELECT id, tenant_id FROM warehouses WHERE id = $1`, [id]);
        updatedRow = whRes.rows[0] || null;
        if (!updatedRow) return null;
    }

    if (hasReferenceUpdate) {
        const refResult = await upsertWarehouseReferenceCode({
            warehouse_id: id,
            tenant_id: tenant_id ?? updatedRow.tenant_id,
            reference_code,
        });
        if (refResult?.message) {
            return { message: refResult.message };
        }
        return { ...updatedRow, reference_code: refResult?.reference_code ?? null };
    }

    return updatedRow;
}

//to be reviewed
export const deleteWarehouseService = async (id) => {
    const result = await pool.query(`
        UPDATE warehouses SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING id`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}