import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { sendEmailService } from "./mail.js";
import { isValidEmail, normalizeEmail } from "../utils/emailNormalize.js";

const BRAND_NAME = "Shopynn";
export const createContactRequestService = async ({ name, email, message }) => {
    const trimmedName = String(name || "").trim();
    const normalizedEmail = normalizeEmail(email);
    const trimmedMessage = String(message || "").trim();

    if (!trimmedName) throw new Error("name is required.");
    if (!isValidEmail(normalizedEmail)) throw new Error("A valid email address is required.");
    if (!trimmedMessage) throw new Error("message is required.");

    const id = uuidv4();
    const now = new Date();
    const result = await pool.query(
        `INSERT INTO contact_requests (id, name, email, message, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'open', $5, $5)
         RETURNING *`,
        [id, trimmedName.slice(0, 200), normalizedEmail, trimmedMessage, now]
    );

    const row = result.rows[0];
    try {
        await sendEmailService({
            sender_name: BRAND_NAME,
            receipient: normalizedEmail,
            subject: `We received your message — ${BRAND_NAME}`,
            text: `Hi ${trimmedName},\n\nThanks for reaching out. We received your message and will get back to you soon.\n\n— ${BRAND_NAME}`,
            html: `<p>Hi ${trimmedName},</p><p>Thanks for reaching out. We received your message and will get back to you soon.</p><p>— ${BRAND_NAME}</p>`,
        });
    } catch (_) {
        // Non-blocking acknowledgment email
    }

    return row;
};

export const listContactRequestsService = async (query = {}) => {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (query.status) {
        conditions.push(`cr.status = $${idx++}`);
        params.push(String(query.status).toLowerCase());
    }

    const search = query.q ?? query.search;
    if (search && String(search).trim()) {
        conditions.push(`(cr.name ILIKE $${idx} OR cr.email ILIKE $${idx} OR cr.message ILIKE $${idx})`);
        params.push(`%${String(search).trim()}%`);
        idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
        `SELECT cr.id, cr.name, cr.email, cr.message, cr.status, cr.admin_notes,
                cr.replied_at, cr.replied_by, cr.created_at, cr.updated_at,
                u.first_name AS replied_by_first_name, u.last_name AS replied_by_last_name
         FROM contact_requests cr
         LEFT JOIN users u ON u.id = cr.replied_by
         ${where}
         ORDER BY cr.created_at DESC`,
        params
    );
    return result.rows;
};

export const getContactRequestByIdService = async (id) => {
    const reqRes = await pool.query(
        `SELECT cr.*, u.first_name AS replied_by_first_name, u.last_name AS replied_by_last_name
         FROM contact_requests cr
         LEFT JOIN users u ON u.id = cr.replied_by
         WHERE cr.id = $1`,
        [id]
    );
    if (reqRes.rowCount === 0) return null;

    const repliesRes = await pool.query(
        `SELECT r.*, u.first_name, u.last_name, u.email AS user_email
         FROM contact_request_replies r
         LEFT JOIN users u ON u.id = r.created_by
         WHERE r.request_id = $1
         ORDER BY r.created_at`,
        [id]
    );

    return { request: reqRes.rows[0], replies: repliesRes.rows };
};

export const updateContactRequestService = async (id, payload = {}) => {
    const existing = await pool.query(`SELECT id FROM contact_requests WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return null;

    const status = payload.status !== undefined ? String(payload.status).toLowerCase() : undefined;
    if (status && !["open", "replied", "closed"].includes(status)) {
        throw new Error("status must be open, replied, or closed.");
    }

    const now = new Date();
    const result = await pool.query(
        `UPDATE contact_requests
         SET status = COALESCE($2, status),
             admin_notes = COALESCE($3, admin_notes),
             updated_at = $4
         WHERE id = $1
         RETURNING *`,
        [id, status || null, payload.admin_notes ?? null, now]
    );
    return result.rows[0];
};

export const replyToContactRequestService = async (id, { message }, userId) => {
    const trimmed = String(message || "").trim();
    if (!trimmed) throw new Error("message is required.");

    const reqRes = await pool.query(`SELECT * FROM contact_requests WHERE id = $1`, [id]);
    if (reqRes.rowCount === 0) return null;

    const request = reqRes.rows[0];
    const now = new Date();
    const replyId = uuidv4();

    await pool.query(
        `INSERT INTO contact_request_replies (id, request_id, message, is_staff, created_by, created_at)
         VALUES ($1, $2, $3, true, $4, $5)`,
        [replyId, id, trimmed, userId || null, now]
    );

    const staffName = BRAND_NAME;
    await sendEmailService({
        sender_name: staffName,
        receipient: request.email,
        subject: `Re: Your message to ${BRAND_NAME}`,
        text: `Hi ${request.name},\n\n${trimmed}\n\n— ${staffName}`,
        html: `<p>Hi ${request.name},</p><p>${trimmed.replace(/\n/g, "<br/>")}</p><p>— ${staffName}</p>`,
    });

    const updated = await pool.query(
        `UPDATE contact_requests
         SET status = 'replied', replied_at = $2, replied_by = $3, updated_at = $2
         WHERE id = $1
         RETURNING *`,
        [id, now, userId || null]
    );

    const repliesRes = await pool.query(
        `SELECT * FROM contact_request_replies WHERE request_id = $1 ORDER BY created_at`,
        [id]
    );

    return { request: updated.rows[0], replies: repliesRes.rows };
};
