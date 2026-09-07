import { handleResponse } from "../util/handleresponse.js";
import { createTransferService, getAllTransfersService, getAllTransferDetailsService, getTransfersSummaryService, getTransferDetailsByIdService } from "../models/transfer.js";
import { createAuditLogService } from "../models/auditLog.js";

export const createTransfer = async (req, res, next) => {
    try {
        const newTransfer = await createTransferService(req.body);

        if (req.user && newTransfer && newTransfer.id) {
            await createAuditLogService({
                user_id: req.user.id,
                tenant_id: req.user.tenant_id,
                action: "TRANSFER_CREATE",
                entity_type: "transfer",
                entity_id: newTransfer.id,
                details: JSON.stringify({
                    source_warehouse_id: req.body.source_warehouse_id,
                    destination_warehouse_id: req.body.destination_warehouse_id,
                    number_of_items: newTransfer.number_of_items,
                    notes: req.body.note ?? req.body.notes ?? null,
                }),
                ip_address: req.ip,
            });
        }

        handleResponse(res, 201, "Transfer creation success.", newTransfer);
    } catch (error) {
        next(error);
    }
}

export const getAllTransfers = async (req, res, next) => {
    try {
        const transfers = await getAllTransfersService(req.user, req.query);
        handleResponse(res, 200, "Transfers list.", transfers);
    } catch (error) {
        next(error);
    }
}

export const getTransfersSummary = async (req, res, next) => {
    try {
        const summary = await getTransfersSummaryService(req.user, req.query);
        handleResponse(res, 200, "Transfers summary.", summary);
    } catch (error) {
        next(error);
    }
}

export const getAllTransferDetails = async (req, res, next) => {
    try {
        const transferItems = await getAllTransferDetailsService();
        handleResponse(res, 200, "Transfer items list.", transferItems);
    } catch (error) {
        next(error);
    }
}

export const getTransferById = async (req, res, next) => {
    try {
        const transfer = await getTransferDetailsByIdService(req.user, req.params.id);
        if (!transfer) return handleResponse(res, 404, "Not found.", null);
        handleResponse(res, 200, "Transfer found.", transfer);
    } catch (error) {
        next(error);
    }
}

