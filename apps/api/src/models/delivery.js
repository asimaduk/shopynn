import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';

export const getAllDeliveriesService = async () => {
    const result = await pool.query("SELECT * FROM deliveries");
    return result.rows;
}

export const getDeliveryByIdService = async (id) => {
    const result = await pool.query("SELECT * FROM deliveries where id = $1", [id]);
    return result.rows[0];
}

export const createDeliveryService = async (payload) => {
    const { current_status, sale_id, tenant_id, sender_id, receiver_id, warehouse_id, sales_date } = payload;
    const id = uuidv4();
    const result = await pool.query(`
        INSERT INTO deliveries (id, current_status, sale_id, tenant_id, sender_id, receiver_id, warehouse_id, sales_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [id, current_status, sale_id, tenant_id, sender_id, receiver_id, warehouse_id, new Date(sales_date), new Date(), new Date()]
    );

    return result.rows[0];
}

export const updateDeliveryService = async (payload) => {
    const { id, current_status, delivered_date } = payload;
    const result = await pool.query(`
        UPDATE deliveries SET current_status=$1, delivered_date=$2, updated_at=$3  WHERE id=$4 RETURNING *`,
        [current_status, new Date(delivered_date), new Date(), id]
    );

    return result.rows[0];
}

//to be reviewed
export const deleteDeliveryService = async (id) => {
    const result = await pool.query(`
        UPDATE deliveries SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}