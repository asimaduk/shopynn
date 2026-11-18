import pool from "../config/db.js";
import { signUserToken } from "../util/authToken.js";
import { DEMO_OWNER_EMAIL, resolveDemoTenantId, settingsIndicateDemo } from "../utils/demoTenant.js";

function demoEnterDisabled() {
    const raw = String(process.env.DEMO_ENTER_ENABLED ?? "true").trim().toLowerCase();
    return raw === "0" || raw === "false" || raw === "no" || raw === "off";
}

/**
 * Public one-click demo: issue a JWT for the Shopynn Demo Store owner.
 * Never returns the password.
 */
export async function enterDemoService() {
    if (demoEnterDisabled()) {
        const err = new Error("Live demo is temporarily unavailable.");
        err.status = 503;
        err.code = "DEMO_ENTER_DISABLED";
        throw err;
    }

    const demoTenantId = await resolveDemoTenantId(pool);
    if (!demoTenantId) {
        const err = new Error("Demo shop is not set up. Run seed:demo-store.");
        err.status = 503;
        err.code = "DEMO_NOT_CONFIGURED";
        throw err;
    }

    const userRes = await pool.query(
        `SELECT u.id, u.email, u.is_active, u.warehouse_id, u.tenant_id, t.settings, t.name AS tenant_name
         FROM users u
         INNER JOIN tenants t ON t.id = u.tenant_id
         WHERE lower(u.email) = lower($1)
           AND u.tenant_id = $2
         LIMIT 1`,
        [DEMO_OWNER_EMAIL, demoTenantId]
    );

    if (!userRes.rowCount) {
        const err = new Error("Demo shop owner account is missing. Run seed:demo-store.");
        err.status = 503;
        err.code = "DEMO_NOT_CONFIGURED";
        throw err;
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
        const err = new Error("Demo shop is temporarily unavailable.");
        err.status = 503;
        err.code = "DEMO_INACTIVE";
        throw err;
    }

    if (!settingsIndicateDemo(user.settings)) {
        await pool.query(
            `UPDATE tenants
             SET settings = COALESCE(settings, '{}'::jsonb) || '{"demo": true}'::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [demoTenantId]
        );
    }

    const token = await signUserToken(
        {
            id: user.id,
            warehouse_id: user.warehouse_id,
            tenant_id: user.tenant_id,
        },
        { expiresIn: process.env.DEMO_JWT_EXPIRES_IN || "12h" }
    );

    return {
        token,
        email: String(user.email).toLowerCase(),
        tenant_name: user.tenant_name || "Shopynn Demo Store",
    };
}
