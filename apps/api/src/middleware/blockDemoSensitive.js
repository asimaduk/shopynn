import pool from "../config/db.js";
import { DEMO_OWNER_EMAIL, DEMO_VISITOR_EMAIL, isDemoTenantId } from "../utils/demoTenant.js";

const MSG =
    "This action is disabled in the live demo. Start a free Shopynn account to manage users, security, and uploads.";

async function rejectIfDemoTenant(req, res, next) {
    try {
        const tenantId = req.user?.tenant_id;
        if (tenantId && (await isDemoTenantId(tenantId, pool))) {
            return res.status(403).json({
                status: 403,
                message: MSG,
                code: "DEMO_ACTION_BLOCKED",
                data: {},
            });
        }
        return next();
    } catch (error) {
        return next(error);
    }
}

/** Password / staff / roles / company / uploads / outbound messaging routes. */
export const blockDemoSensitive = rejectIfDemoTenant;

/**
 * Block forgot-password for demo accounts (public route — no JWT).
 */
export async function blockDemoForgotPassword(req, res, next) {
    try {
        const email = String(req.body?.email || "")
            .trim()
            .toLowerCase();
        if (
            email &&
            (email === DEMO_OWNER_EMAIL ||
                email === DEMO_VISITOR_EMAIL ||
                email === "demo-agent@shopynn.app")
        ) {
            return res.status(403).json({
                status: 403,
                message: "Password reset is disabled for demo accounts.",
                code: "DEMO_ACTION_BLOCKED",
                data: {},
            });
        }
        if (!email) return next();

        const row = await pool.query(
            `SELECT t.settings
             FROM users u
             INNER JOIN tenants t ON t.id = u.tenant_id
             WHERE lower(u.email) = $1
             LIMIT 1`,
            [email]
        );
        if (row.rows[0]?.settings?.demo === true) {
            return res.status(403).json({
                status: 403,
                message: "Password reset is disabled for demo accounts.",
                code: "DEMO_ACTION_BLOCKED",
                data: {},
            });
        }
        return next();
    } catch (error) {
        return next(error);
    }
}

export default blockDemoSensitive;
