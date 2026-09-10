import { handleResponse } from "../util/handleresponse.js";
import {
    getBroadcastAudienceCountsService,
    sendBroadcastService,
} from "../models/broadcast.js";

export const getBroadcastAudienceCounts = async (req, res, next) => {
    try {
        const audience = req.query?.audience === "all" ? "all" : "myself";
        const counts = await getBroadcastAudienceCountsService({
            audience,
            user: req.user,
        });
        handleResponse(res, 200, "Broadcast audience counts.", counts);
    } catch (error) {
        next(error);
    }
};

export const sendBroadcast = async (req, res, next) => {
    try {
        const {
            title,
            body,
            channels,
            audience: rawAudience,
            confirm_all,
            create_in_app,
        } = req.body || {};

        const audience = rawAudience === "all" ? "all" : "myself";
        if (audience === "all" && confirm_all !== true) {
            return handleResponse(
                res,
                400,
                "Broadcasting to all users requires confirm_all: true.",
                null
            );
        }

        const summary = await sendBroadcastService({
            audience,
            channels: channels || {},
            title,
            body,
            user: req.user,
            createInApp: create_in_app !== false,
        });
        handleResponse(res, 200, "Broadcast completed.", summary);
    } catch (error) {
        if (
            error?.message?.includes("required") ||
            error?.message?.includes("Select at least")
        ) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};
