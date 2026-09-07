import { handleResponse } from "../util/handleresponse.js";
import {
    getReturnsHistoryService,
    getReturnByIdService,
    getReturnDetailsService,
    createReturnService,
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
        next(error);
    }
};
