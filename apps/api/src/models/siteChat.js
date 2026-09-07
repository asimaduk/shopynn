import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { sendEmailService } from "./mail.js";
import { isValidEmail, normalizeEmail } from "../utils/emailNormalize.js";

const BRAND_NAME = "Shopynn";

const mapMessage = (row) => ({
    id: row.id,
    body: row.body,
    sender_type: row.sender_type,
    created_at: row.created_at,
    is_staff: row.sender_type === "staff",
});

export const getSiteChatSessionByTokenService = async (visitorToken) => {
    const token = String(visitorToken || "").trim();
    if (!token) return null;

    const sessionRes = await pool.query(
        `SELECT id, visitor_token, name, email, status, admin_notes, last_message_at, created_at, updated_at
         FROM site_chat_sessions WHERE visitor_token = $1`,
        [token]
    );
    if (sessionRes.rowCount === 0) return null;

    const messagesRes = await pool.query(
        `SELECT id, body, sender_type, created_by, created_at
         FROM site_chat_messages
         WHERE session_id = $1
         ORDER BY created_at ASC`,
        [sessionRes.rows[0].id]
    );

    return {
        session: sessionRes.rows[0],
        messages: messagesRes.rows.map(mapMessage),
    };
};

export const startOrContinueSiteChatService = async ({
    visitor_token,
    name,
    email,
    message,
    source = "shopynn-widget",
}) => {
    const trimmedMessage = String(message || "").trim();
    if (!trimmedMessage) throw new Error("message is required.");

    const existingToken = String(visitor_token || "").trim();
    if (existingToken) {
        const existing = await getSiteChatSessionByTokenService(existingToken);
        if (existing && existing.session.status !== "closed") {
            const msg = await appendVisitorMessageService(existing.session.id, trimmedMessage);
            return {
                session: existing.session,
                messages: [...existing.messages, msg],
                visitor_token: existingToken,
            };
        }
    }

    const trimmedName = String(name || "").trim();
    const normalizedEmail = normalizeEmail(email);
    if (!trimmedName) throw new Error("name is required.");
    if (!isValidEmail(normalizedEmail)) throw new Error("A valid email address is required.");

    const sessionId = uuidv4();
    const newToken = uuidv4();
    const now = new Date();

    await pool.query(
        `INSERT INTO site_chat_sessions
            (id, visitor_token, name, email, status, source, last_message_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'open', $5, $6, $6, $6)`,
        [sessionId, newToken, trimmedName.slice(0, 200), normalizedEmail, source, now]
    );

    const firstMessage = await insertMessageService(sessionId, trimmedMessage, "visitor", null, now);

    try {
        await sendEmailService({
            sender_name: BRAND_NAME,
            receipient: normalizedEmail,
            subject: `We received your chat — ${BRAND_NAME}`,
            text: `Hi ${trimmedName},\n\nThanks for messaging us. Our team will reply here and by email when we're back online.\n\n— ${BRAND_NAME}`,
            html: `<p>Hi ${trimmedName},</p><p>Thanks for messaging us. Our team will reply as soon as we can.</p><p>— ${BRAND_NAME}</p>`,
        });
    } catch (_) {
        // non-blocking
    }

    const sessionRes = await pool.query(`SELECT * FROM site_chat_sessions WHERE id = $1`, [sessionId]);
    return {
        session: sessionRes.rows[0],
        messages: [mapMessage(firstMessage)],
        visitor_token: newToken,
    };
};

async function insertMessageService(sessionId, body, senderType, createdBy, at = new Date()) {
    const id = uuidv4();
    const result = await pool.query(
        `INSERT INTO site_chat_messages (id, session_id, body, sender_type, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, body, sender_type, created_by, created_at`,
        [id, sessionId, body, senderType, createdBy, at]
    );
    await pool.query(
        `UPDATE site_chat_sessions SET last_message_at = $2, updated_at = $2 WHERE id = $1`,
        [sessionId, at]
    );
    return result.rows[0];
}

async function appendVisitorMessageService(sessionId, message) {
    const sessionRes = await pool.query(`SELECT status FROM site_chat_sessions WHERE id = $1`, [sessionId]);
    if (sessionRes.rowCount === 0) throw new Error("Chat session not found.");
    if (sessionRes.rows[0].status === "closed") {
        throw new Error("This chat is closed. Please start a new conversation.");
    }
    const row = await insertMessageService(sessionId, message, "visitor", null);
    return mapMessage(row);
}

export const appendVisitorMessageByTokenService = async (visitorToken, message) => {
    const data = await getSiteChatSessionByTokenService(visitorToken);
    if (!data) return null;
    const msg = await appendVisitorMessageService(data.session.id, String(message || "").trim());
    const refreshed = await getSiteChatSessionByTokenService(visitorToken);
    return { ...refreshed, new_message: msg };
};

export const listSiteChatSessionsService = async (query = {}) => {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (query.status) {
        conditions.push(`s.status = $${idx++}`);
        params.push(String(query.status).toLowerCase());
    }

    const search = query.q ?? query.search;
    if (search && String(search).trim()) {
        conditions.push(`(s.name ILIKE $${idx} OR s.email ILIKE $${idx})`);
        params.push(`%${String(search).trim()}%`);
        idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
        `SELECT s.id, s.visitor_token, s.name, s.email, s.status, s.source, s.last_message_at, s.created_at, s.updated_at,
                (SELECT body FROM site_chat_messages m WHERE m.session_id = s.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_preview,
                (SELECT COUNT(*)::int FROM site_chat_messages m WHERE m.session_id = s.id) AS message_count
         FROM site_chat_sessions s
         ${where}
         ORDER BY COALESCE(s.last_message_at, s.created_at) DESC`,
        params
    );
    return result.rows;
};

export const getSiteChatSessionByIdService = async (id) => {
    const sessionRes = await pool.query(
        `SELECT s.*, u.first_name AS replied_by_first_name, u.last_name AS replied_by_last_name
         FROM site_chat_sessions s
         LEFT JOIN users u ON u.id = s.replied_by
         WHERE s.id = $1`,
        [id]
    );
    if (sessionRes.rowCount === 0) return null;

    const messagesRes = await pool.query(
        `SELECT m.id, m.body, m.sender_type, m.created_by, m.created_at,
                u.first_name, u.last_name
         FROM site_chat_messages m
         LEFT JOIN users u ON u.id = m.created_by
         WHERE m.session_id = $1
         ORDER BY m.created_at ASC`,
        [id]
    );

    return {
        session: sessionRes.rows[0],
        messages: messagesRes.rows.map((row) => ({
            ...mapMessage(row),
            staff_name: row.sender_type === "staff"
                ? [row.first_name, row.last_name].filter(Boolean).join(" ") || BRAND_NAME
                : null,
        })),
    };
};

export const updateSiteChatSessionService = async (id, payload = {}) => {
    const existing = await pool.query(`SELECT id FROM site_chat_sessions WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return null;

    const status = payload.status !== undefined ? String(payload.status).toLowerCase() : undefined;
    if (status && !["open", "replied", "closed"].includes(status)) {
        throw new Error("status must be open, replied, or closed.");
    }

    const now = new Date();
    const result = await pool.query(
        `UPDATE site_chat_sessions
         SET status = COALESCE($2, status),
             admin_notes = COALESCE($3, admin_notes),
             updated_at = $4
         WHERE id = $1
         RETURNING *`,
        [id, status || null, payload.admin_notes ?? null, now]
    );
    return result.rows[0];
};

export const replyToSiteChatSessionService = async (id, { message }, userId) => {
    const trimmed = String(message || "").trim();
    if (!trimmed) throw new Error("message is required.");

    const sessionRes = await pool.query(`SELECT * FROM site_chat_sessions WHERE id = $1`, [id]);
    if (sessionRes.rowCount === 0) return null;

    const session = sessionRes.rows[0];
    const now = new Date();
    await insertMessageService(session.id, trimmed, "staff", userId || null, now);

    await sendEmailService({
        sender_name: BRAND_NAME,
        receipient: session.email,
        subject: `New reply from ${BRAND_NAME}`,
        text: `Hi ${session.name},\n\n${trimmed}\n\n— ${BRAND_NAME} Support`,
        html: `<p>Hi ${session.name},</p><p>${trimmed.replace(/\n/g, "<br/>")}</p><p>— ${BRAND_NAME} Support</p>`,
    });

    const updated = await pool.query(
        `UPDATE site_chat_sessions
         SET status = 'replied', replied_at = $2, replied_by = $3, updated_at = $2
         WHERE id = $1
         RETURNING *`,
        [id, now, userId || null]
    );

    return getSiteChatSessionByIdService(updated.rows[0].id);
};
