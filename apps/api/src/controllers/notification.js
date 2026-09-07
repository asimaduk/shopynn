import { handleResponse } from "../util/handleresponse.js";
import {
    getNotificationsService,
    getNotificationByIdService,
    createNotificationService,
    markNotificationReadService,
} from "../models/notification.js";
import { sendToTokens, sendToTopic } from "../services/firebaseMessaging.js";

export const getNotifications = async (req, res, next) => {
    try {
        const notifications = await getNotificationsService(req.user, req.query);
        handleResponse(res, 200, "Notifications.", notifications);
    } catch (error) {
        next(error);
    }
};

export const getNotificationById = async (req, res, next) => {
    try {
        const notification = await getNotificationByIdService(req.params.id, req.user.tenant_id, req.user.id);
        if (!notification) return handleResponse(res, 404, "Notification not found.");
        handleResponse(res, 200, "Notification.", notification);
    } catch (error) {
        next(error);
    }
};

export const createNotification = async (req, res, next) => {
    try {
        const payload = {
            ...req.body,
            tenant_id: req.body.tenant_id ?? req.user?.tenant_id,
        };
        const created = await createNotificationService(payload);
        handleResponse(res, 201, "Notification created.", created);
    } catch (error) {
        next(error);
    }
};

export const markAsRead = async (req, res, next) => {
    try {
        const updated = await markNotificationReadService(req.params.id, req.user.tenant_id, req.user.id);
        if (!updated) return handleResponse(res, 404, "Notification not found.");
        handleResponse(res, 200, "Notification marked as read.", updated);
    } catch (error) {
        next(error);
    }
};

/**
 * Send FCM message to tokens and/or topic. Works for Android, iOS, and Web.
 * Body: { tokens?: string[], topic?: string, notification?: { title, body?, imageUrl? }, data?: object, android?, apns?, webpush? }
 * Either tokens or topic (or both) must be provided.
 */
export const sendFcmMessage = async (req, res, next) => {
    try {
        const { tokens, topic, notification, data, android, apns, webpush } = req.body;
        const hasTokens = Array.isArray(tokens) ? tokens.length > 0 : !!tokens;
        const hasTopic = typeof topic === "string" && topic.trim().length > 0;
        if (!hasTokens && !hasTopic) {
            return handleResponse(res, 400, "Provide tokens (array) and/or topic (string).");
        }
        const options = { notification, data, android, apns, webpush };
        const results = {};
        if (hasTokens) {
            const arr = Array.isArray(tokens) ? tokens : [tokens];
            results.tokens = await sendToTokens(arr, options);
        }
        if (hasTopic) {
            results.topic = await sendToTopic(topic.trim(), options);
        }
        handleResponse(res, 200, "FCM send completed.", results);
    } catch (error) {
        next(error);
    }
};
