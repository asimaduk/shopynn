import { getMerchantByUserId } from "../models/merchant.js";

/**
 * After auth: attaches req.merchant for users with a merchants row.
 */
const requireMerchant = async (req, res, next) => {
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
        req.merchant = merchant;
        next();
    } catch (err) {
        console.error("requireMerchant:", err);
        return res.status(500).json({ status: 500, message: "Failed to verify merchant.", data: null });
    }
};

export default requireMerchant;
