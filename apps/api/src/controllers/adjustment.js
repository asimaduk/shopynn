import { handleResponse } from "../util/handleresponse.js";
import { createAdjustmentService, getAdjustmentsSummaryService, getAllAdjustmentDetailsService, getAllAdjustmentsService } from "../models/adjustment.js";
import { createAuditLogService } from "../models/auditLog.js";

export const createAdjustment = async (req, res, next) => {
    try {
        const newAdjustment = await createAdjustmentService({
            ...req.body,
            tenant_id: req.user?.tenant_id,
            creator_id: req.user?.id,
        });
        handleResponse(res, 201, "Adjustment creation success.", newAdjustment);

        if (req.user && newAdjustment && newAdjustment.id) {
            await createAuditLogService({
                user_id: req.user.id,
                tenant_id: req.user.tenant_id,
                action: "ADJUSTMENT_CREATE",
                entity_type: "adjustment",
                entity_id: newAdjustment.id,
                details: JSON.stringify({
                    description: `Adjustment created for ${req.body?.products?.length ?? 0} item(s).`,
                    items: req.body?.products
                }),
                ip_address: req.ip,
            });
        }
    } catch (error) {
        next(error);
    }
}

export const getAllAdjustments = async (req, res, next) => {
    try {
        const adjustments = await getAllAdjustmentsService(req.user, req.query);
        handleResponse(res, 200, "Adjustments list.", adjustments);
    } catch (error) {
        next(error);
    }
}

export const getAdjustmentsSummary = async (req, res, next) => {
    try {
        const summary = await getAdjustmentsSummaryService(req.user, req.query);
        handleResponse(res, 200, "Adjustments summary.", summary);
    } catch (error) {
        next(error);
    }
}

export const getAllAdjustmentDetails = async (req, res, next) => {
    try {
        const adjustmentItems = await getAllAdjustmentDetailsService();
        handleResponse(res, 200, "Adjustment items list.", adjustmentItems);
    } catch (error) {
        next(error);
    }
}