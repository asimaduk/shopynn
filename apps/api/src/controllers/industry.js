import { handleResponse } from "../util/handleresponse.js";
import {
    createIndustryService,
    getAllIndustriesService,
    getIndustryByIdService,
} from "../models/industry.js";

export const createIndustry = async (req, res, next) => {
    try {
        const industry = await createIndustryService(req.body);
        handleResponse(res, 201, "Industry created.", industry);
    } catch (error) {
        if (error.message?.includes("name is required")) {
            return handleResponse(res, 400, error.message, null);
        }
        if (error.code === "23505") {
            return handleResponse(res, 400, "Industry with this name or code already exists.", null);
        }
        next(error);
    }
};

export const getIndustries = async (req, res, next) => {
    try {
        const industries = await getAllIndustriesService(req.query);
        handleResponse(res, 200, "Industries list.", industries);
    } catch (error) {
        next(error);
    }
};

export const getIndustryById = async (req, res, next) => {
    try {
        const industry = await getIndustryByIdService(req.params.id);
        if (!industry) return handleResponse(res, 404, "Industry not found.", null);
        handleResponse(res, 200, "Industry found.", industry);
    } catch (error) {
        next(error);
    }
};

