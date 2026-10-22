import { getMerchantByUserId, AGENT_STATUS, AGENT_TYPE } from "../models/merchant.js";

const STATUS_MESSAGES = {
    [AGENT_STATUS.PENDING_APPROVAL]: "Your agent account is awaiting approval.",
    [AGENT_STATUS.REJECTED]: "Your agent application was not approved.",
    [AGENT_STATUS.DEACTIVATED]: "Your agent account has been deactivated.",
};

/**
 * After auth: attaches req.merchant for users with a merchants row.
 * By default the agent must be active; `{ anyStatus: true }` lets deactivated agents read their history.
 */
const buildRequireMerchant = ({ anyStatus = false, managerOnly = false } = {}) => async (req, res, next) => {
    if (!req.user?.id) {
        return res.status(401).json({ status: 401, message: "Authentication required.", data: null });
    }
    try {
        const merchant = await getMerchantByUserId(req.user.id);
        if (!merchant) {
            return res.status(403).json({
                status: 403,
                message: "Merchant access required.",
                data: null,
            });
        }
        if (!anyStatus && merchant.status !== AGENT_STATUS.ACTIVE) {
            return res.status(403).json({
                status: 403,
                message: STATUS_MESSAGES[merchant.status] || "Your agent account is not active.",
                data: null,
            });
        }
        if (managerOnly && merchant.agent_type !== AGENT_TYPE.MANAGER) {
            return res.status(403).json({ status: 403, message: "Agent manager access required.", data: null });
        }
        req.merchant = merchant;
        next();
    } catch (err) {
        console.error("requireMerchant:", err);
        return res.status(500).json({ status: 500, message: "Failed to verify merchant.", data: null });
    }
};

const requireMerchant = buildRequireMerchant();

export const requireMerchantRecord = buildRequireMerchant({ anyStatus: true });
export const requireAgentManager = buildRequireMerchant({ managerOnly: true });

export default requireMerchant;
