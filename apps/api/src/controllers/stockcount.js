import { handleResponse } from "../util/handleresponse.js";
import {
    getStockCountsHistoryService,
    getStockCountByIdService,
    getStockCountDetailsService,
    createStockCountService,
} from "../models/stockcount.js";

export const getStockCountsHistory = async (req, res, next) => {
    try {
        const history = await getStockCountsHistoryService(req.user, req.query);
        handleResponse(res, 200, "Stock counts history.", history);
    } catch (error) {
        next(error);
    }
};

export const getStockCountById = async (req, res, next) => {
    try {
        const stockCount = await getStockCountByIdService(req.params.id, req.user.tenant_id);
        if (!stockCount) return handleResponse(res, 404, "Stock count not found.");
        const items = await getStockCountDetailsService(req.params.id, req.user.tenant_id);
        stockCount.items = items;
        handleResponse(res, 200, "Stock count.", stockCount);
    } catch (error) {
        next(error);
    }
};

export const createStockCount = async (req, res, next) => {
    try {
        const payload = {
            ...req.body,
            creator_id: req.user?.id,
            tenant_id: req.user?.tenant_id,
        };
        const created = await createStockCountService(payload);
        handleResponse(res, 201, "Stock count created.", created);
    } catch (error) {
        next(error);
    }
};
