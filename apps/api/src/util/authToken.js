import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/db.js";
import { getRequestContext } from "./requestContext.js";

const DEFAULT_TTL = process.env.JWT_EXPIRES_IN || "30d";

/** Records the sign-in for the signed-in devices list. Null if it can't be stored; the token then has no sid. */
const createUserSession = async (userId, tokenVersion) => {
    const ctx = getRequestContext();
    const id = uuidv4();
    try {
        await pool.query(
            `INSERT INTO user_sessions (id, user_id, token_version, device_name, platform, app_version, ip, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, userId, tokenVersion, ctx.deviceName, ctx.platform, ctx.appVersion, ctx.ip, ctx.userAgent]
        );
        return id;
    } catch (err) {
        console.error("user session create failed:", err?.message || err);
        return null;
    }
};

/** Signs an API token carrying the user's current token_version, so revokeUserTokens can invalidate it. */
export const signUserToken = async (user, { expiresIn = DEFAULT_TTL } = {}) => {
    const r = await pool.query("SELECT token_version FROM users WHERE id = $1", [user.id]);
    const tv = Number(r.rows[0]?.token_version) || 0;
    const sid = await createUserSession(user.id, tv);
    return jwt.sign(
        {
            id: user.id,
            warehouse_id: user.warehouse_id,
            tenant_id: user.tenant_id,
            tv,
            ...(sid ? { sid } : {}),
        },
        process.env.JWT_SECRET,
        { expiresIn }
    );
};

/** Signs the user out everywhere: every token issued before this call stops working. */
export const revokeUserTokens = (userId, db = pool) =>
    db.query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [userId]);
