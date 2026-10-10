import { handleResponse } from "../util/handleresponse.js";
import {
    getNotificationsService,
    getNotificationByIdService,
    createNotificationService,
    markNotificationReadService,
} from "../models/notification.js";
import { sendToTokens, sendToTopic } from "../services/firebaseMessaging.js";
import pool from "../config/db.js";

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
 * Send FCM message to devices and/or the shop topic. Works for Android, iOS, and Web.
 * Body: { tokens?: string[], topic?: "tenant_<your shop id>", notification?: { title, body?, imageUrl? }, data?: object }
 * Tokens must belong to users of the caller's shop; the only allowed topic is the caller's shop topic.
 */
export const sendFcmMessage = async (req, res, next) => {
    try {
        const { tokens, topic, notification, data } = req.body;
        const tenantId = req.user.tenant_id;
        const requested = (Array.isArray(tokens) ? tokens : tokens ? [tokens] : [])
            .map((t) => String(t || "").trim())
            .filter(Boolean);
        const hasTopic = typeof topic === "string" && topic.trim().length > 0;
        if (!requested.length && !hasTopic) {
            return handleResponse(res, 400, "Provide tokens (array) and/or topic (string).");
        }
        const shopTopic = `tenant_${tenantId}`;
        if (hasTopic && topic.trim() !== shopTopic) {
            return handleResponse(res, 403, `You can only send to your shop's topic (${shopTopic}).`);
        }
        const options = { notification, data };
        const results = {};
        if (requested.length) {
            const own = await pool.query(
                `SELECT DISTINCT u.fcm_token
                 FROM users u
                 LEFT JOIN customer_profiles cp ON cp.user_id = u.id AND cp.tenant_id = $1
                 WHERE u.fcm_token = ANY($2::text[]) AND (u.tenant_id = $1 OR cp.id IS NOT NULL)`,
                [tenantId, requested]
            );
            const allowed = own.rows.map((r) => r.fcm_token);
            if (allowed.length !== new Set(requested).size) {
                return handleResponse(res, 403, "Some devices don't belong to people in your shop.");
            }
            results.tokens = await sendToTokens(allowed, options);
        }
        if (hasTopic) {
            results.topic = await sendToTopic(shopTopic, options);
        }
        handleResponse(res, 200, "FCM send completed.", results);
    } catch (error) {
        next(error);
    }
};
