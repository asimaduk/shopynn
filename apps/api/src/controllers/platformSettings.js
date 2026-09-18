import { handleResponse } from "../util/handleresponse.js";
import {
    getMomoPaymentChargeSettingsService,
    updateMomoPaymentChargeSettingsService,
} from "../models/platformSettings.js";

/** Any authenticated user — needed for POS / checkout fee display. */
export const getMomoPaymentCharge = async (req, res, next) => {
    try {
        const settings = await getMomoPaymentChargeSettingsService();
        handleResponse(res, 200, "MoMo payment charge settings.", settings);
    } catch (error) {
        next(error);
    }
};

/** Platform super admin (tenants.directory.view). */
export const updateMomoPaymentCharge = async (req, res, next) => {
    try {
        const settings = await updateMomoPaymentChargeSettingsService(req.body || {}, req.user?.id);
        handleResponse(res, 200, "MoMo payment charge updated.", settings);
    } catch (error) {
        next(error);
    }
};
