import { handleResponse } from "../util/handleresponse.js";
import {
    getReturnsHistoryService,
    getReturnByIdService,
    getReturnDetailsService,
    createReturnService,
    getSaleReturnableLinesService,
    getOrderReturnableLinesService,
} from "../models/return.js";

export const getReturnsHistory = async (req, res, next) => {
    try {
        const history = await getReturnsHistoryService(req.user, req.query);
        handleResponse(res, 200, "Returns history.", history);
    } catch (error) {
        next(error);
    }
};

export const getReturnById = async (req, res, next) => {
    try {
        const returnRecord = await getReturnByIdService(req.params.id, req.user.tenant_id);
        if (!returnRecord) return handleResponse(res, 404, "Return not found.");
        const details = await getReturnDetailsService(req.params.id, req.user.tenant_id);
        returnRecord.details = details;
        handleResponse(res, 200, "Return.", returnRecord);
    } catch (error) {
        next(error);
    }
};

export const getSaleReturnable = async (req, res, next) => {
    try {
        const data = await getSaleReturnableLinesService(req.user, req.params.saleId);
        if (!data) return handleResponse(res, 404, "Sale not found.");
        handleResponse(res, 200, "Returnable sale lines.", data);
    } catch (error) {
        next(error);
    }
};

export const getOrderReturnable = async (req, res, next) => {
    try {
        const data = await getOrderReturnableLinesService(req.user, req.params.orderId);
        if (!data) return handleResponse(res, 404, "Order not found.");
        handleResponse(res, 200, "Returnable order lines.", data);
    } catch (error) {
        next(error);
    }
};

export const createReturn = async (req, res, next) => {
    try {
        const payload = {
            ...req.body,
            creator_id: req.user?.id,
            tenant_id: req.user?.tenant_id,
        };
        const created = await createReturnService(payload);
        handleResponse(res, 201, "Return created.", created);
    } catch (error) {
        if (error?.status === 404) {
            return handleResponse(res, 404, error.message, error?.code ? { code: error.code } : null);
        }
        if (error?.status === 400 || error?.code) {
            return handleResponse(res, 400, error.message, error?.code ? { code: error.code } : null);
        }
        next(error);
    }
};
