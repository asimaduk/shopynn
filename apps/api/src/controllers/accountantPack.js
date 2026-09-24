import { handleResponse } from "../util/handleresponse.js";
import { buildAccountantPackService } from "../models/accountantPack.js";

/** GET /dashboard/accountant-pack?startDate=&endDate= → JSON with CSV file payloads */
export const getAccountantPack = async (req, res, next) => {
    try {
        const pack = await buildAccountantPackService({
            tenantId: req.user.tenant_id,
            startDate: req.query.startDate || req.query.start_date,
            endDate: req.query.endDate || req.query.end_date,
        });
        handleResponse(res, 200, "Accountant pack.", pack);
    } catch (error) {
        next(error);
    }
};

export default { getAccountantPack };
