import { handleResponse } from "../util/handleresponse.js";
import { getAuditLogsService } from "../models/auditLog.js";

export const getAuditLogs = async (req, res, next) => {
    try {
        const logs = await getAuditLogsService(req.user.tenant_id, req.query);
        handleResponse(res, 200, "Audit logs.", logs);
    } catch (error) {
        next(error);
    }
};
