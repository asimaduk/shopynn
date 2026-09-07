import express from "express";
import {
    getNotifications,
    getNotificationById,
    createNotification,
    markAsRead,
    sendFcmMessage,
} from "../controllers/notification.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const STAFF_NOTIFICATION_VIEW = [
    "notifications.view",
    "notifications.mark_read",
    "notifications.settings.view",
];

const router = express.Router();

router.get("/", requireAnyPermission(...STAFF_NOTIFICATION_VIEW), getNotifications);
router.post("/send-fcm", requirePermission("notifications.push.send"), sendFcmMessage);
router.patch("/:id/read", requirePermission("notifications.mark_read"), markAsRead);
router.get("/:id", requireAnyPermission(...STAFF_NOTIFICATION_VIEW), getNotificationById);
router.post("/", requirePermission("notifications.push.send"), createNotification);

export default router;
