import pool from "../config/db.js";
import { resolveSubscriptionFeatureCodesService } from "../models/subscription.js";

/**
 * Middleware that requires the authenticated user's tenant to have an active subscription.
 * Must be used after the auth middleware (req.user.tenant_id must be set).
 *
 * Active = tenant has a subscription_id, the subscription exists,
 * and (end_at is null or end_at >= now) and (start_at is null or start_at <= now).
 */
const requireActiveSubscription = async (req, res, next) => {
    if (!req.user?.tenant_id) {
        return res.status(401).json({ error: "Authentication required." });
    }

    try {
        const result = await pool.query(
            `SELECT s.id, s.name, s.status, s.start_at, s.end_at, s.features
             FROM tenants t
             INNER JOIN subscriptions s ON t.subscription_id = s.id
             WHERE t.id = $1`,
            [req.user.tenant_id]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({
                error: "No active subscription.",
                code: "SUBSCRIPTION_REQUIRED",
            });
        }

        const sub = result.rows[0];
        const now = new Date();

        if (String(sub.status || "").toLowerCase() !== "active") {
            return res.status(403).json({
                error: "Subscription is not active.",
                code: "SUBSCRIPTION_INACTIVE",
            });
        }

        if (sub.start_at && new Date(sub.start_at) > now) {
            return res.status(403).json({
                error: "Subscription not yet active.",
                code: "SUBSCRIPTION_NOT_STARTED",
            });
        }

        if (sub.end_at && new Date(sub.end_at) < now) {
            return res.status(403).json({
                error: "Subscription has expired.",
                code: "SUBSCRIPTION_EXPIRED",
            });
        }

        const features = await resolveSubscriptionFeatureCodesService({
            subscriptionId: sub.id,
            subscriptionName: sub.name,
            fallbackFeatures: sub.features,
        });

        req.subscription = {
            id: sub.id,
            name: sub.name,
            status: sub.status,
            start_at: sub.start_at,
            end_at: sub.end_at,
            features,
        };
        next();
    } catch (err) {
        console.error("requireActiveSubscription:", err);
        res.status(500).json({ error: "Failed to verify subscription." });
    }
};

export default requireActiveSubscription;
