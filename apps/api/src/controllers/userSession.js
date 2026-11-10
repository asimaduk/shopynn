import {
    listUserSessionsService,
    revokeOtherUserSessionsService,
    revokeUserSessionService,
} from "../models/userSession.js";
import { handleResponse } from "../util/handleresponse.js";

export const listMySessions = async (req, res, next) => {
    try {
        const sessions = await listUserSessionsService(req.user.id, req.user.sid);
        handleResponse(res, 200, "Signed-in devices.", sessions);
    } catch (error) {
        next(error);
    }
};

/** `:id` may be "current" to sign this device out on the server as well as locally. */
export const revokeMySession = async (req, res, next) => {
    try {
        const sessionId = req.params.id === "current" ? req.user.sid : req.params.id;
        if (!sessionId) return handleResponse(res, 200, "Signed out.");
        const revoked = await revokeUserSessionService(req.user.id, sessionId);
        if (!revoked) return handleResponse(res, 404, "Device not found or already signed out.");
        handleResponse(res, 200, "Device signed out.");
    } catch (error) {
        next(error);
    }
};

export const revokeMyOtherSessions = async (req, res, next) => {
    try {
        const count = await revokeOtherUserSessionsService(req.user.id, req.user.sid);
        handleResponse(res, 200, "Other devices signed out.", { signed_out: count });
    } catch (error) {
        next(error);
    }
};
