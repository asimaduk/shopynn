import cron from "node-cron";
import pool from "../config/db.js";

const SUBSCRIPTION_EXPIRY_CRON = "0 1 * * *"; // 1:00 AM daily

export const runSubscriptionExpiryCheck = async () => {
    const now = new Date();
    const result = await pool.query(
        `UPDATE subscriptions
         SET status = 'expired',
             updated_at = $1
         WHERE end_at IS NOT NULL
           AND end_at <= $1
           AND status = 'active'
         RETURNING id`,
        [now]
    );

    if (result.rowCount > 0) {
        console.log(`[subscription-job] Expired ${result.rowCount} subscription(s).`);
    } else {
        console.log("[subscription-job] No subscriptions due for expiry.");
    }

    return result.rowCount;
};

export const startSubscriptionStatusJob = () => {
    // Run once at startup so overdue subscriptions are corrected immediately.
    runSubscriptionExpiryCheck().catch((error) => {
        console.error("[subscription-job] Startup check failed:", error);
    });

    cron.schedule(SUBSCRIPTION_EXPIRY_CRON, async () => {
        try {
            await runSubscriptionExpiryCheck();
        } catch (error) {
            console.error("[subscription-job] Failed:", error);
        }
    });

    console.log("[subscription-job] Scheduled daily expiry check at 1:00 AM.");
};

