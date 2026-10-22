import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const DEFAULT_TTL = process.env.JWT_EXPIRES_IN || "30d";

/** Signs an API token carrying the user's current token_version, so revokeUserTokens can invalidate it. */
export const signUserToken = async (user, { expiresIn = DEFAULT_TTL } = {}) => {
    const r = await pool.query("SELECT token_version FROM users WHERE id = $1", [user.id]);
    return jwt.sign(
        {
            id: user.id,
            warehouse_id: user.warehouse_id,
            tenant_id: user.tenant_id,
            tv: Number(r.rows[0]?.token_version) || 0,
        },
        process.env.JWT_SECRET,
        { expiresIn }
    );
};

/** Signs the user out everywhere: every token issued before this call stops working. */
export const revokeUserTokens = (userId, db = pool) =>
    db.query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [userId]);
