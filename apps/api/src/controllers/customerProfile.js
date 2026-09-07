import {
    getCustomerStoresService,
    linkCustomerStoreService,
    resolveStoreReferencePublicService,
    signupCustomerAccountService,
    signupCustomerProfileService,
} from "../models/customerProfile.js";
import { handleResponse } from "../util/handleresponse.js";

export const signupCustomerProfile = async (req, res, next) => {
    try {
        const data = await signupCustomerProfileService(req.user, req.body);
        handleResponse(res, 201, "Customer profile signup success.", data);
    } catch (error) {
        if (error.message?.includes("required") || error.message?.includes("Invalid")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const linkCustomerStore = async (req, res, next) => {
    try {
        const data = await linkCustomerStoreService(req.user, req.body);
        handleResponse(res, 201, "Store linked.", data);
    } catch (error) {
        if (
            error.message?.includes("required") ||
            error.message?.includes("Invalid") ||
            error.message?.includes("not found")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const getCustomerStores = async (req, res, next) => {
    try {
        const stores = await getCustomerStoresService(req.user);
        handleResponse(res, 200, "Customer stores.", stores);
    } catch (error) {
        next(error);
    }
};

export const verifyStoreReferencePublic = async (req, res, next) => {
    try {
        const data = await resolveStoreReferencePublicService(req.body?.reference_code);
        handleResponse(res, 200, "Store reference verified.", data);
    } catch (error) {
        if (error.message?.includes("required") || error.message?.includes("Invalid")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const signupCustomerAccount = async (req, res, next) => {
    try {
        const data = await signupCustomerAccountService(req.body);
        handleResponse(res, 201, "Customer account created.", data);
    } catch (error) {
        if (
            error.message?.includes("required") ||
            error.message?.includes("Invalid") ||
            error.message?.includes("exists")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};
