import cron from "node-cron";
import pool from "../config/db.js";
import { DEMO_OWNER_EMAIL, clearDemoTenantCache, resolveDemoTenantId } from "../utils/demoTenant.js";
import { runDemoCatalogSeed } from "../../scripts/seed-demo-catalog.mjs";

/** 03:00 Africa/Accra — refresh shared demo catalog + activity; keep users/passwords. */
const DEMO_RESET_CRON = process.env.DEMO_RESET_CRON || "0 3 * * *";
const DEMO_RESET_TZ = process.env.DEMO_RESET_TZ || "Africa/Accra";

export const runDemoStoreReset = async () => {
    const demoTenantId = await resolveDemoTenantId(pool);
    if (!demoTenantId) {
        console.log("[demo-reset] No demo tenant found; skip.");
        return { skipped: true };
    }

    console.log(`[demo-reset] Reseeding demo catalog for tenant ${demoTenantId} (${DEMO_OWNER_EMAIL})…`);
    await runDemoCatalogSeed({
        email: DEMO_OWNER_EMAIL,
        wipe: true,
        noActivity: false,
        pool,
    });

    // Keep demo flag sticky after wipe (catalog seed does not touch settings).
    await pool.query(
        `UPDATE tenants
         SET settings = COALESCE(settings, '{}'::jsonb) || '{"demo": true}'::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [demoTenantId]
    );
    clearDemoTenantCache();

    console.log("[demo-reset] Done.");
    return { ok: true, tenantId: demoTenantId };
};

export const startDemoStoreResetJob = () => {
    if (String(process.env.DEMO_RESET_ENABLED ?? "true").toLowerCase() === "false") {
        console.log("[demo-reset] Disabled via DEMO_RESET_ENABLED=false.");
        return;
    }

    cron.schedule(
        DEMO_RESET_CRON,
        async () => {
            try {
                await runDemoStoreReset();
            } catch (error) {
                console.error("[demo-reset] Failed:", error?.message || error);
            }
        },
        { timezone: DEMO_RESET_TZ }
    );

    console.log(`[demo-reset] Scheduled (${DEMO_RESET_CRON}, ${DEMO_RESET_TZ}).`);
};
