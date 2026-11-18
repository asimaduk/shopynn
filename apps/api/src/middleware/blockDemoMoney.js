import pool from "../config/db.js";
import { isDemoTenantId } from "../utils/demoTenant.js";

const DEMO_MONEY_MESSAGE =
    "Real payments and payouts are disabled in the demo shop. Start a free Shopynn account to use MoMo and withdrawals.";

/**
 * Block Paystack / money-moving actions on the shared demo tenant.
 * Use after `auth` on initiate/OTP/withdrawal/settlement/payout routes.
 */
export async function blockDemoMoney(req, res, next) {
    try {
        const tenantId = req.user?.tenant_id;
        if (tenantId && (await isDemoTenantId(tenantId, pool))) {
            return res.status(403).json({
                status: 403,
                message: DEMO_MONEY_MESSAGE,
                code: "DEMO_MONEY_BLOCKED",
                data: {},
            });
        }
        return next();
    } catch (error) {
        return next(error);
    }
}

export default blockDemoMoney;
