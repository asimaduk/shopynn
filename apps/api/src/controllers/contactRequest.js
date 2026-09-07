import { handleResponse } from "../util/handleresponse.js";
import {
    createContactRequestService,
    listContactRequestsService,
    getContactRequestByIdService,
    updateContactRequestService,
    replyToContactRequestService,
} from "../models/contactRequest.js";

export const publicCreateContactRequest = async (req, res, next) => {
    try {
        const request = await createContactRequestService(req.body);
        handleResponse(res, 201, "Thanks! We received your message.", { request });
    } catch (error) {
        if (error.message?.includes("required") || error.message?.includes("valid email")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const listContactRequests = async (req, res, next) => {
    try {
        const requests = await listContactRequestsService(req.query);
        handleResponse(res, 200, "Contact requests.", { requests });
    } catch (error) {
        next(error);
    }
};

export const getContactRequest = async (req, res, next) => {
    try {
        const data = await getContactRequestByIdService(req.params.id);
        if (!data) return handleResponse(res, 404, "Contact request not found.", null);
        handleResponse(res, 200, "Contact request.", data);
    } catch (error) {
        next(error);
    }
};

export const updateContactRequest = async (req, res, next) => {
    try {
        const request = await updateContactRequestService(req.params.id, req.body);
        if (!request) return handleResponse(res, 404, "Contact request not found.", null);
        handleResponse(res, 200, "Contact request updated.", { request });
    } catch (error) {
        if (error.message?.includes("status must")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const replyToContactRequest = async (req, res, next) => {
    try {
        const data = await replyToContactRequestService(req.params.id, req.body, req.user?.id);
        if (!data) return handleResponse(res, 404, "Contact request not found.", null);
        handleResponse(res, 200, "Reply sent.", data);
    } catch (error) {
        if (error.message?.includes("required")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};
