import express from "express";
import { publicSubscribeNewsletter, publicUnsubscribeNewsletter } from "../controllers/newsletter.js";
import { publicCreateContactRequest } from "../controllers/contactRequest.js";
import {
    publicStartSiteChat,
    publicGetSiteChat,
    publicSendSiteChatMessage,
} from "../controllers/siteChat.js";
import { getBillingCatalogPublic } from "../controllers/billing.js";

const router = express.Router();

router.post("/newsletter/subscribe", publicSubscribeNewsletter);
router.post("/newsletter/unsubscribe", publicUnsubscribeNewsletter);
router.post("/contact", publicCreateContactRequest);

router.post("/chat/session", publicStartSiteChat);
router.get("/chat/session/:token", publicGetSiteChat);
router.post("/chat/session/:token/messages", publicSendSiteChatMessage);

router.get("/billing/catalog", getBillingCatalogPublic);

export default router;
