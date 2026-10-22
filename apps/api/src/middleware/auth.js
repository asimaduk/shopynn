import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

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
    if (!decode?.id || !decode.exp) return sessionExpired(res);

    try {
        const r = await pool.query('SELECT is_active, deleted, token_version FROM users WHERE id = $1', [decode.id]);
        const account = r.rows[0];
        if (!account || !account.is_active || account.deleted === true) return sessionExpired(res);
        if ((Number(decode.tv) || 0) !== Number(account.token_version)) return sessionExpired(res);
    } catch (error) {
        return next(error);
    }

    req.user = decode;

    if(req.body) {
        req.body.creator_id = decode.id;
        req.body.tenant_id = decode.tenant_id;

        if(decode.user_type != 1) {
            // requirePermission restores this for users with multi-store access.
            req.requestedWarehouseId = req.body.warehouse_id;
            req.body.warehouse_id = decode.warehouse_id;
        }
    }
    next();
};

export default auth;
