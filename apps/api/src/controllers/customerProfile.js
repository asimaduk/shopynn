import {
    getCustomerStoresService,
    linkCustomerStoreService,
    resolveStoreReferencePublicService,
    signupCustomerProfileService,
} from "../models/customerProfile.js";
import {
    completeCustomerSignupPhoneService,
    sendCustomerSignupPhoneOtpService,
    verifyCustomerSignupPhoneOtpService,
} from "../models/customerSignupPhone.js";
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

export const sendCustomerSignupPhoneOtp = async (req, res, next) => {
    try {
        const data = await sendCustomerSignupPhoneOtpService(req.body || {});
        handleResponse(res, 200, "OTP sent.", data);
    } catch (error) {
        return handleResponse(
            res,
            error.status || 400,
            error.message || "Failed.",
            error?.code ? { code: error.code } : null
        );
    }
};

export const verifyCustomerSignupPhoneOtp = async (req, res, next) => {
    try {
        const data = await verifyCustomerSignupPhoneOtpService(req.body || {});
        handleResponse(res, 200, "Phone verified.", data);
    } catch (error) {
        return handleResponse(
            res,
            error.status || 400,
            error.message || "Failed.",
            error?.code ? { code: error.code } : null
        );
    }
};

export const signupCustomerAccount = async (req, res, next) => {
    try {
        const data = await completeCustomerSignupPhoneService(req.body || {});
        handleResponse(res, 201, "Customer account ready.", data);
    } catch (error) {
        return handleResponse(
            res,
            error.status || 400,
            error.message || "Failed.",
            error?.code ? { code: error.code } : null
        );
    }
};
