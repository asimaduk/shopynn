import { handleResponse } from "../util/handleresponse.js";
import {
    getPublicStorefrontService,
    getPublicStoreCatalogService,
    getPublicStoreProductService,
    sendStorefrontPhoneOtpService,
    verifyStorefrontPhoneOtpService,
    createStorefrontOrderService,
    publicVerifyStorefrontOrderPaymentService,
} from "../models/storefront.js";

export const publicGetStore = async (req, res, next) => {
    try {
        const data = await getPublicStorefrontService(req.params.code);
        handleResponse(res, 200, "Store.", data);
    } catch (error) {
        if (error?.status === 400 || error?.message) {
            return handleResponse(res, error.status || 400, error.message);
        }
        next(error);
    }
};

export const publicGetStoreCatalog = async (req, res, next) => {
    try {
        const data = await getPublicStoreCatalogService(req.params.code, req.query);
        handleResponse(res, 200, "Store catalog.", data);
    } catch (error) {
        return handleResponse(res, error.status || 400, error.message || "Failed.");
    }
};

export const publicGetStoreProduct = async (req, res, next) => {
    try {
        const data = await getPublicStoreProductService(req.params.code, req.params.productId);
        if (!data) return handleResponse(res, 404, "Product not found.");
        handleResponse(res, 200, "Product.", data);
    } catch (error) {
        return handleResponse(res, error.status || 400, error.message || "Failed.");
    }
};

export const publicSendStorefrontOtp = async (req, res, next) => {
    try {
        const data = await sendStorefrontPhoneOtpService({
            phone: req.body?.phone,
            reference_code: req.params.code || req.body?.reference_code,
        });
        handleResponse(res, 200, "OTP sent.", data);
    } catch (error) {
        return handleResponse(res, error.status || 400, error.message || "Failed.", error?.code ? { code: error.code } : null);
    }
};

export const publicVerifyStorefrontOtp = async (req, res, next) => {
    try {
        const data = await verifyStorefrontPhoneOtpService({
            phone: req.body?.phone,
            otp: req.body?.otp,
            reference_code: req.params.code || req.body?.reference_code,
        });
        handleResponse(res, 200, "Phone verified.", data);
    } catch (error) {
        return handleResponse(res, error.status || 400, error.message || "Failed.", error?.code ? { code: error.code } : null);
    }
};

export const publicCreateStorefrontOrder = async (req, res, next) => {
    try {
        const data = await createStorefrontOrderService({
            ...req.body,
            reference_code: req.params.code || req.body?.reference_code,
        });
        handleResponse(res, 201, "Order created.", data);
    } catch (error) {
        return handleResponse(res, error.status || 400, error.message || "Failed.", error?.code ? { code: error.code } : null);
    }
};

export const publicVerifyStorefrontOrderPayment = async (req, res, next) => {
    try {
        const data = await publicVerifyStorefrontOrderPaymentService({
            reference_code: req.params.code,
            orderId: req.params.orderId,
            reference: req.body?.reference || req.query?.reference,
        });
        handleResponse(res, 200, "Payment verified.", data);
    } catch (error) {
        return handleResponse(res, error.status || 400, error.message || "Failed.", error?.code ? { code: error.code } : null);
    }
};
