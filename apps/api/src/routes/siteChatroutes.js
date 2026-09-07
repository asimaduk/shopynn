import express from "express";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
    listSiteChats,
    getSiteChat,
    updateSiteChat,
    replyToSiteChat,
} from "../controllers/siteChat.js";

const router = express.Router();

router.get(
    "/",
    auth,
    requireActiveSubscription,
    requireFeature("site_chat.sessions.view"),
    requirePermission("site_chat.sessions.view"),
    listSiteChats
);
router.get(
    "/:id",
    auth,
    requireActiveSubscription,
    requireFeature("site_chat.sessions.view"),
    requirePermission("site_chat.sessions.view"),
    getSiteChat
);
router.patch(
    "/:id",
    auth,
    requireActiveSubscription,
    requireFeature("site_chat.sessions.view"),
    requirePermission("site_chat.sessions.view"),
    updateSiteChat
);
router.post(
    "/:id/reply",
    auth,
    requireActiveSubscription,
    requireFeature("site_chat.sessions.respond"),
    requirePermission("site_chat.sessions.respond"),
    replyToSiteChat
);

export default router;
