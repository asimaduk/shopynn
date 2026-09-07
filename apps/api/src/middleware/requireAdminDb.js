import pool from "../config/db.js";

/** Requires authenticated user with user_type === 1 (admin). Uses DB lookup since JWT may omit user_type. */
const requireAdminDb = async (req, res, next) => {
    if (!req.user?.id) {
        return res.status(401).json({ status: 401, message: "Authentication required.", data: null });
    }
    try {
        const r = await pool.query("SELECT user_type FROM users WHERE id = $1", [req.user.id]);
        if (r.rows[0]?.user_type !== 1) {
            return res.status(403).json({ status: 403, message: "Admin only.", data: null });
        }
        next();
    } catch (err) {
        console.error("requireAdminDb:", err);
        return res.status(500).json({ status: 500, message: "Failed to verify admin.", data: null });
    }
};

export default requireAdminDb;
