import { createAuditLogService } from "../models/auditLog.js";

/** Records a shop audit event for the signed-in user. Never throws: the action already succeeded. */
export const recordAudit = async (req, action, entityType, entityId, details = null, tenantId = req.user?.tenant_id) => {
    if (!req.user?.id || !tenantId) return;
    try {
        await createAuditLogService({
            user_id: req.user.id,
            tenant_id: tenantId,
            action,
            entity_type: entityType,
            entity_id: entityId ?? null,
            details: details ? JSON.stringify(details) : null,
            ip_address: req.ip,
        });
    } catch (error) {
        console.error(`recordAudit ${action}:`, error?.message || error);
    }
};
