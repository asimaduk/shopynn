import express from "express";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
    listNewsletterSubscribers,
    updateNewsletterSubscriber,
    listNewsletterCampaigns,
    getNewsletterCampaign,
    createNewsletterCampaign,
    updateNewsletterCampaign,
    sendNewsletterCampaign,
} from "../controllers/newsletter.js";

const router = express.Router();

router.get(
    "/subscribers",
    auth,
    requireActiveSubscription,
    requireFeature("newsletter.subscribers.view"),
    requirePermission("newsletter.subscribers.view"),
    listNewsletterSubscribers
);
router.patch(
    "/subscribers/:id",
    auth,
    requireActiveSubscription,
    requireFeature("newsletter.subscribers.view"),
    requirePermission("newsletter.subscribers.view"),
    updateNewsletterSubscriber
);

router.get(
    "/campaigns",
    auth,
    requireActiveSubscription,
    requireFeature("newsletter.campaigns.view"),
    requirePermission("newsletter.campaigns.view"),
    listNewsletterCampaigns
);
router.get(
    "/campaigns/:id",
    auth,
    requireActiveSubscription,
    requireFeature("newsletter.campaigns.view"),
    requirePermission("newsletter.campaigns.view"),
    getNewsletterCampaign
);
router.post(
    "/campaigns",
    auth,
    requireActiveSubscription,
    requireFeature("newsletter.campaigns.send"),
    requirePermission("newsletter.campaigns.send"),
    createNewsletterCampaign
);
router.put(
    "/campaigns/:id",
    auth,
    requireActiveSubscription,
    requireFeature("newsletter.campaigns.send"),
    requirePermission("newsletter.campaigns.send"),
    updateNewsletterCampaign
);
router.post(
    "/campaigns/:id/send",
    auth,
    requireActiveSubscription,
    requireFeature("newsletter.campaigns.send"),
    requirePermission("newsletter.campaigns.send"),
    sendNewsletterCampaign
);

export default router;
