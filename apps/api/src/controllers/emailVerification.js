import {
    sendShopOwnerEmailOtpService,
    verifyShopOwnerEmailOtpService,
    sendCustomerChangeEmailOtpService,
    verifyCustomerChangeEmailOtpService,
} from "../models/emailVerification.js";
import { handleResponse } from "../util/handleresponse.js";

export const sendShopOwnerSignupEmailOtp = async (req, res, next) => {
    try {
        const email = req.body?.email;
        const result = await sendShopOwnerEmailOtpService(email);
        handleResponse(res, 200, "Verification code sent.", result);
    } catch (error) {
        if (
            error.message?.includes("required") ||
            error.message?.includes("valid email") ||
            error.message?.includes("already exists") ||
            error.message?.includes("wait a minute")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const verifyShopOwnerSignupEmailOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body || {};
        const result = await verifyShopOwnerEmailOtpService(email, otp);
        handleResponse(res, 200, "Email verified.", result);
    } catch (error) {
        if (
            error.message?.includes("required") ||
            error.message?.includes("6-digit") ||
            error.message?.includes("Incorrect") ||
            error.message?.includes("expired") ||
            error.message?.includes("attempts") ||
            error.message?.includes("No active")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

const isClientError = (message) => {
    const msg = String(message || "");
    return (
        msg.includes("required") ||
        msg.includes("valid email") ||
        msg.includes("real email") ||
        msg.includes("already") ||
        msg.includes("wait a minute") ||
        msg.includes("6-digit") ||
        msg.includes("Incorrect") ||
        msg.includes("expired") ||
        msg.includes("attempts") ||
        msg.includes("No active") ||
        msg.includes("Only customer") ||
        msg.includes("Not authenticated") ||
        msg.includes("Could not update") ||
        msg.includes("mobile number") ||
        msg.includes("phone")
    );
};

export const sendCustomerChangeEmailOtp = async (req, res, next) => {
    try {
        const result = await sendCustomerChangeEmailOtpService({
            userId: req.user?.id,
            email: req.body?.email,
        });
        handleResponse(res, 200, "Verification code sent.", result);
    } catch (error) {
        if (isClientError(error.message)) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const verifyCustomerChangeEmailOtp = async (req, res, next) => {
    try {
        const result = await verifyCustomerChangeEmailOtpService({
            userId: req.user?.id,
            email: req.body?.email,
            otp: req.body?.otp,
        });
        handleResponse(res, 200, "Email updated.", result);
    } catch (error) {
        if (isClientError(error.message)) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};
