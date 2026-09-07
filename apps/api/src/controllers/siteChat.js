import { handleResponse } from "../util/handleresponse.js";
import {
    getSiteChatSessionByTokenService,
    startOrContinueSiteChatService,
    appendVisitorMessageByTokenService,
    listSiteChatSessionsService,
    getSiteChatSessionByIdService,
    updateSiteChatSessionService,
    replyToSiteChatSessionService,
} from "../models/siteChat.js";

export const publicStartSiteChat = async (req, res, next) => {
    try {
        const result = await startOrContinueSiteChatService(req.body);
        handleResponse(res, 201, "Message sent.", result);
    } catch (error) {
        if (
            error.message?.includes("required") ||
            error.message?.includes("valid email") ||
            error.message?.includes("closed")
        ) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const publicGetSiteChat = async (req, res, next) => {
    try {
        const data = await getSiteChatSessionByTokenService(req.params.token);
        if (!data) return handleResponse(res, 404, "Chat session not found.", null);
        handleResponse(res, 200, "Chat session.", data);
    } catch (error) {
        next(error);
    }
};

export const publicSendSiteChatMessage = async (req, res, next) => {
    try {
        const trimmed = String(req.body?.message || "").trim();
        if (!trimmed) return handleResponse(res, 400, "message is required.", null);

        const data = await appendVisitorMessageByTokenService(req.params.token, trimmed);
        if (!data) return handleResponse(res, 404, "Chat session not found.", null);
        handleResponse(res, 200, "Message sent.", data);
    } catch (error) {
        if (error.message?.includes("closed")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const listSiteChats = async (req, res, next) => {
    try {
        const sessions = await listSiteChatSessionsService(req.query);
        handleResponse(res, 200, "Site chat sessions.", { sessions });
    } catch (error) {
        next(error);
    }
};

export const getSiteChat = async (req, res, next) => {
    try {
        const data = await getSiteChatSessionByIdService(req.params.id);
        if (!data) return handleResponse(res, 404, "Chat session not found.", null);
        handleResponse(res, 200, "Chat session.", data);
    } catch (error) {
        next(error);
    }
};

export const updateSiteChat = async (req, res, next) => {
    try {
        const session = await updateSiteChatSessionService(req.params.id, req.body);
        if (!session) return handleResponse(res, 404, "Chat session not found.", null);
        handleResponse(res, 200, "Chat session updated.", { session });
    } catch (error) {
        if (error.message?.includes("status must")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const replyToSiteChat = async (req, res, next) => {
    try {
        const data = await replyToSiteChatSessionService(req.params.id, req.body, req.user?.id);
        if (!data) return handleResponse(res, 404, "Chat session not found.", null);
        handleResponse(res, 200, "Reply sent.", data);
    } catch (error) {
        if (error.message?.includes("required")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};
