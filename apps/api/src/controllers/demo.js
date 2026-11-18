import { handleResponse } from "../util/handleresponse.js";
import { enterDemoService } from "../models/demoEnter.js";

export const enterDemo = async (req, res, next) => {
    try {
        const data = await enterDemoService();
        handleResponse(res, 200, "Demo session ready.", data);
    } catch (error) {
        if (error?.status) {
            return res.status(error.status).json({
                status: error.status,
                message: error.message || "Demo unavailable.",
                code: error.code || "DEMO_ERROR",
                data: {},
            });
        }
        next(error);
    }
};
