import pool from "../config/db.js";

const ACTIVE_SESSION = `s.revoked_at IS NULL AND s.token_version = u.token_version`;

/** Signed-in devices, most recently used first. Sessions older than the token lifetime are hidden. */
export const listUserSessionsService = async (userId, currentSid) => {
    const r = await pool.query(
        `SELECT s.id, s.device_name, s.platform, s.app_version, s.ip, s.user_agent, s.created_at, s.last_seen_at
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.user_id = $1 AND ${ACTIVE_SESSION} AND s.created_at > now() - interval '30 days'
         ORDER BY s.last_seen_at DESC
         LIMIT 50`,
        [userId]
    );
    return r.rows.map((row) => ({ ...row, current: Boolean(currentSid) && row.id === currentSid }));
};

export const revokeUserSessionService = async (userId, sessionId) => {
    const r = await pool.query(
        `UPDATE user_sessions SET revoked_at = now()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
         RETURNING id`,
        [sessionId, userId]
    );
    return r.rowCount > 0;
};

/** Signs out every other recorded device, keeping the caller's session. */
export const revokeOtherUserSessionsService = async (userId, currentSid) => {
    const r = await pool.query(
        `UPDATE user_sessions SET revoked_at = now()
         WHERE user_id = $1 AND revoked_at IS NULL AND ($2::varchar IS NULL OR id <> $2)`,
        [userId, currentSid || null]
    );
    return r.rowCount;
};
