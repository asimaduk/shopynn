import pool from "../config/db.js";
import { signUserToken } from "../util/authToken.js";
import {
    DEMO_VISITOR_EMAIL,
    resolveDemoTenantId,
    settingsIndicateDemo,
} from "../utils/demoTenant.js";

function demoEnterDisabled() {
    const raw = String(process.env.DEMO_ENTER_ENABLED ?? "true").trim().toLowerCase();
    return raw === "0" || raw === "false" || raw === "no" || raw === "off";
}

function configuredSecret() {
    return String(process.env.DEMO_ENTER_SECRET || "").trim();
}

function requireSecretInProduction() {
    return process.env.NODE_ENV === "production" && !configuredSecret();
}

/**
 * Shared secret: only our web/server frontends should call enter.
 * Header `X-Demo-Enter-Secret` or body.demo_secret.
 */
function assertSharedSecret(reqLike) {
    const expected = configuredSecret();
    if (!expected) {
        if (requireSecretInProduction()) {
            const err = new Error("Live demo is misconfigured (DEMO_ENTER_SECRET missing).");
            err.status = 503;
            err.code = "DEMO_ENTER_MISCONFIGURED";
            throw err;
        }
        return;
    }
    const headerVal =
        typeof reqLike?.get === "function"
            ? reqLike.get("x-demo-enter-secret")
            : reqLike?.headers?.["x-demo-enter-secret"];
    const provided = String(headerVal || reqLike?.body?.demo_secret || "").trim();
    if (!provided || provided !== expected) {
        const err = new Error("Demo enter is not authorized.");
        err.status = 403;
        err.code = "DEMO_ENTER_FORBIDDEN";
        throw err;
    }
}

/**
 * Optional Cloudflare Turnstile when TURNSTILE_SECRET_KEY is set.
 */
async function assertCaptchaIfConfigured(token) {
    const secret = String(process.env.TURNSTILE_SECRET_KEY || process.env.DEMO_ENTER_CAPTCHA_SECRET || "").trim();
    if (!secret) return;

    const response = String(token || "").trim();
    if (!response) {
        const err = new Error("Complete the captcha to enter the demo.");
        err.status = 400;
        err.code = "DEMO_CAPTCHA_REQUIRED";
        throw err;
    }

    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", response);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.success) {
        const err = new Error("Captcha verification failed. Try again.");
        err.status = 403;
        err.code = "DEMO_CAPTCHA_FAILED";
        throw err;
    }
}

/**
 * Public one-click demo: JWT for the restricted Demo Visitor (not the owner).
 * Never returns passwords.
 */
export async function enterDemoService(reqLike = {}) {
    if (demoEnterDisabled()) {
        const err = new Error("Live demo is temporarily unavailable.");
        err.status = 503;
        err.code = "DEMO_ENTER_DISABLED";
        throw err;
    }

    assertSharedSecret(reqLike);
    await assertCaptchaIfConfigured(reqLike?.body?.captcha_token || reqLike?.body?.cf_turnstile_response);

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
        [DEMO_VISITOR_EMAIL, demoTenantId]
    );

    if (!userRes.rowCount) {
        const err = new Error("Demo visitor account is missing. Run seed:demo-store.");
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
        { expiresIn: process.env.DEMO_JWT_EXPIRES_IN || "4h" }
    );

    return {
        token,
        email: String(user.email).toLowerCase(),
        tenant_name: user.tenant_name || "Shopynn Demo Store",
    };
}
