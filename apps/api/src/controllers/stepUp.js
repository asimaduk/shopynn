import { sendStepUpCodeService, verifyStepUpCodeService } from "../models/stepUp.js";
import { handleResponse } from "../util/handleresponse.js";

const clientError = (res, error) => {
    if (error.isStepUpValidation) return handleResponse(res, 400, error.message);
    if (error.code === "OTP_QUOTA") return handleResponse(res, 429, error.message);
    return null;
};

export const sendStepUpCode = async (req, res, next) => {
    try {
        const result = await sendStepUpCodeService(req.user.id);
        handleResponse(res, 200, "Confirmation code sent.", result);
    } catch (error) {
        if (clientError(res, error) === null) next(error);
    }
};

export const verifyStepUpCode = async (req, res, next) => {
    try {
        const result = await verifyStepUpCodeService(req.user, req.body?.otp);
        handleResponse(res, 200, "Confirmed.", result);
    } catch (error) {
        if (clientError(res, error) === null) next(error);
    }
};
