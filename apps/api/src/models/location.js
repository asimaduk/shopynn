import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { checkTenantCanAddLocation } from "./subscription.js";

export const getAllLocationsService = async (user) => {
    const result = await pool.query(`
        SELECT
            l.id,
            l.name,
            l.manager,
            l.phone,
            l.tenant_id,
            l.address,
            l.notes,
            l.created_at,
            COUNT(w.id)::int AS warehouses_count
        FROM locations l
        LEFT JOIN warehouses w ON w.location_id = l.id AND w.tenant_id = l.tenant_id
        WHERE l.tenant_id = $1
        GROUP BY l.id, l.name, l.manager, l.phone, l.tenant_id, l.address, l.notes, l.created_at
    `, [user.tenant_id]);
    return result.rows;
}

export const getLocationByIdService = async (id) => {
    const result = await pool.query("SELECT id, name, manager, phone, tenant_id, address, notes, created_at FROM locations where id = $1", [id]);
    return result.rows[0];
}

export const createLocationService = async (payload) => {
    const { name, manager, phone, tenant_id, address, notes, creator_id } = payload;
    if (!tenant_id) {
        return { message: "tenant_id is required." };
    }
    const cap = await checkTenantCanAddLocation(tenant_id);
    if (!cap.ok) {
        return { message: cap.message };
    }
    const id = uuidv4();
    const result = await pool.query(`
        INSERT INTO locations (id, name, manager, phone, tenant_id, address, notes, creator_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [id, name, manager, phone, tenant_id, address, notes, creator_id, new Date(), new Date()]
    );

    return result.rows[0];
}

export const updateLocationService = async (payload) => {
    const { id, name, manager, phone, address } = payload;
    const result = await pool.query(`
        UPDATE locations SET name=$1, manager=$2, phone=$3, address=$4, updated_at=$5 WHERE id=$6 RETURNING *`,
        [ name, manager, phone, address, new Date(), id]
    );

    return result.rows[0];
}

//to be reviewed
export const deleteLocationService = async (id) => {
    const result = await pool.query(`
        UPDATE locations SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}