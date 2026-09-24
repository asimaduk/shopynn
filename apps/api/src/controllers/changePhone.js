import {
    sendChangePhoneOtpService,
    verifyChangePhoneOtpService,
} from "../models/changePhone.js";
import { handleResponse } from "../util/handleresponse.js";

const isClientError = (message) => {
    const msg = String(message || "");
    return (
        msg.includes("required") ||
        msg.includes("valid") ||
        msg.includes("mobile number") ||
        msg.includes("already") ||
        msg.includes("wait") ||
        msg.includes("6-digit") ||
        msg.includes("Incorrect") ||
        msg.includes("expired") ||
        msg.includes("attempts") ||
        msg.includes("No active") ||
        msg.includes("Not authenticated") ||
        msg.includes("Could not update") ||
        msg.includes("phone")
    );
};

export const sendChangePhoneOtp = async (req, res, next) => {
    try {
        const result = await sendChangePhoneOtpService({
            userId: req.user?.id,
            phone: req.body?.phone,
        });
        handleResponse(res, 200, "Verification code sent.", result);
    } catch (error) {
        if (isClientError(error.message)) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const verifyChangePhoneOtp = async (req, res, next) => {
    try {
        const result = await verifyChangePhoneOtpService({
            userId: req.user?.id,
            phone: req.body?.phone,
            otp: req.body?.otp,
        });
        handleResponse(res, 200, "Phone updated.", result);
    } catch (error) {
        if (isClientError(error.message)) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};
