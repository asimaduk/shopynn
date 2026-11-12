import { handleResponse } from "../util/handleresponse.js";
import {
    subscribeNewsletterService,
    unsubscribeNewsletterService,
    listNewsletterSubscribersService,
    updateNewsletterSubscriberStatusService,
    listNewsletterCampaignsService,
    getNewsletterCampaignByIdService,
    createNewsletterCampaignService,
    updateNewsletterCampaignService,
    sendNewsletterCampaignService,
} from "../models/newsletter.js";

export const publicSubscribeNewsletter = async (req, res, next) => {
    try {
        const result = await subscribeNewsletterService(req.body);
        const message = result.alreadySubscribed
            ? "You are already subscribed."
            : result.reactivated
              ? "Welcome back! You are subscribed again."
              : "Thanks for subscribing!";
        handleResponse(res, 200, message, result);
    } catch (error) {
        if (error.message?.includes("valid email")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

const isUnsubscribeInputError = (error) =>
    error.message?.includes("valid email") || error.message?.includes("link is invalid");

export const publicUnsubscribeNewsletter = async (req, res, next) => {
    try {
        await unsubscribeNewsletterService({ email: req.body?.email, token: req.body?.token });
        handleResponse(res, 200, "You've been unsubscribed from Shopynn updates.", null);
    } catch (error) {
        if (isUnsubscribeInputError(error)) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

/** RFC 8058 one-click: mail apps POST to the List-Unsubscribe URL with the email and token in the query. */
export const publicOneClickUnsubscribeNewsletter = async (req, res, next) => {
    try {
        await unsubscribeNewsletterService({ email: req.query.e, token: req.query.t });
        res.status(200).type("text/plain").send("Unsubscribed.");
    } catch (error) {
        if (isUnsubscribeInputError(error)) {
            return res.status(400).type("text/plain").send(error.message);
        }
        next(error);
    }
};

export const listNewsletterSubscribers = async (req, res, next) => {
    try {
        const subscribers = await listNewsletterSubscribersService(req.query);
        handleResponse(res, 200, "Newsletter subscribers.", { subscribers });
    } catch (error) {
        next(error);
    }
};

export const updateNewsletterSubscriber = async (req, res, next) => {
    try {
        const row = await updateNewsletterSubscriberStatusService(req.params.id, req.body.status);
        if (!row) return handleResponse(res, 404, "Subscriber not found.", null);
        handleResponse(res, 200, "Subscriber updated.", { subscriber: row });
    } catch (error) {
        if (error.message?.includes("status must")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const listNewsletterCampaigns = async (req, res, next) => {
    try {
        const campaigns = await listNewsletterCampaignsService(req.query);
        handleResponse(res, 200, "Newsletter campaigns.", { campaigns });
    } catch (error) {
        next(error);
    }
};

export const getNewsletterCampaign = async (req, res, next) => {
    try {
        const data = await getNewsletterCampaignByIdService(req.params.id);
        if (!data) return handleResponse(res, 404, "Campaign not found.", null);
        handleResponse(res, 200, "Newsletter campaign.", data);
    } catch (error) {
        next(error);
    }
};

export const createNewsletterCampaign = async (req, res, next) => {
    try {
        const campaign = await createNewsletterCampaignService(req.body, req.user?.id);
        handleResponse(res, 201, "Draft newsletter created.", { campaign });
    } catch (error) {
        if (error.message?.includes("required")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const updateNewsletterCampaign = async (req, res, next) => {
    try {
        const campaign = await updateNewsletterCampaignService(req.params.id, req.body);
        if (!campaign) return handleResponse(res, 404, "Campaign not found.", null);
        handleResponse(res, 200, "Newsletter updated.", { campaign });
    } catch (error) {
        if (error.message?.includes("cannot") || error.message?.includes("empty")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const sendNewsletterCampaign = async (req, res, next) => {
    try {
        const result = await sendNewsletterCampaignService(req.params.id, req.user?.id);
        if (!result) return handleResponse(res, 404, "Campaign not found.", null);
        handleResponse(res, 200, "Newsletter sent.", result);
    } catch (error) {
        if (
            error.message?.includes("already sent") ||
            error.message?.includes("required") ||
            error.message?.includes("No active subscribers")
        ) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};
