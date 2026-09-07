import {
    sendShopOwnerEmailOtpService,
    verifyShopOwnerEmailOtpService,
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
