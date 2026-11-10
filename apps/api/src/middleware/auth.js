import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const LAST_SEEN_RESOLUTION_MS = 5 * 60 * 1000;

const sessionExpired = (res) =>
    res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'SESSION_EXPIRED' });

const auth = async (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token.' });

    let decode;
    try {
        decode = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return sessionExpired(res);
    }
    // Tokens issued before expiry was introduced never expire, so they are refused outright.
    if (!decode?.id || !decode.exp || decode.purpose) return sessionExpired(res);

    try {
        const r = await pool.query('SELECT is_active, deleted, token_version FROM users WHERE id = $1', [decode.id]);
        const account = r.rows[0];
        if (!account || !account.is_active || account.deleted === true) return sessionExpired(res);
        if ((Number(decode.tv) || 0) !== Number(account.token_version)) return sessionExpired(res);
        // Tokens issued before sessions were recorded have no sid and stay valid until they expire.
        if (decode.sid) {
            const s = await pool.query(
                'SELECT revoked_at, last_seen_at FROM user_sessions WHERE id = $1 AND user_id = $2',
                [decode.sid, decode.id]
            );
            const session = s.rows[0];
            if (!session || session.revoked_at) return sessionExpired(res);
            if (Date.now() - new Date(session.last_seen_at).getTime() > LAST_SEEN_RESOLUTION_MS) {
                pool.query('UPDATE user_sessions SET last_seen_at = now() WHERE id = $1', [decode.sid]).catch(() => {});
            }
        }
    } catch (error) {
        return next(error);
    }

    req.user = decode;

    if(req.body) {
        req.body.creator_id = decode.id;
        req.body.tenant_id = decode.tenant_id;
        // requirePermission restores this for users with multi-store access.
        req.requestedWarehouseId = req.body.warehouse_id;
        req.body.warehouse_id = decode.warehouse_id;
    }
    next();
};

export default auth;
