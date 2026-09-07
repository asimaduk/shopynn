import { handleResponse } from "../util/handleresponse.js";
import { getDashboardDataService, getProfitAndLossService, getCashFlowService } from "../models/dashboard.js";

export const getDashboard = async (req, res, next) => {
    try {
        const data = await getDashboardDataService(req.user, { recentLimit: req.query.recentLimit });
        handleResponse(res, 200, "Dashboard data.", data);
    } catch (error) {
        next(error);
    }
};

export const getProfitAndLoss = async (req, res, next) => {
    try {
        const report = await getProfitAndLossService(req.user, req.query);
        handleResponse(res, 200, "Profit and loss.", report);
    } catch (error) {
        next(error);
    }
};

export const getCashFlow = async (req, res, next) => {
    try {
        const report = await getCashFlowService(req.user, req.query);
        handleResponse(res, 200, "Cash flow.", report);
    } catch (error) {
        next(error);
    }
};
