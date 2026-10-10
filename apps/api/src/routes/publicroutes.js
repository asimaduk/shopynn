import express from "express";
import { publicSubscribeNewsletter, publicUnsubscribeNewsletter } from "../controllers/newsletter.js";
import { publicCreateContactRequest } from "../controllers/contactRequest.js";
import {
    publicStartSiteChat,
    publicGetSiteChat,
    publicSendSiteChatMessage,
} from "../controllers/siteChat.js";
import { getBillingCatalogPublic } from "../controllers/billing.js";
import {
    publicGetStore,
    publicGetStoreCatalog,
    publicGetStoreProduct,
    publicSendStorefrontOtp,
    publicVerifyStorefrontOtp,
    publicCreateStorefrontOrder,
    publicVerifyStorefrontOrderPayment,
} from "../controllers/storefront.js";

import { otpSendLimit, credentialCheckLimit, publicFormLimit, publicChatMessageLimit } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/newsletter/subscribe", publicFormLimit, publicSubscribeNewsletter);
router.post("/newsletter/unsubscribe", publicFormLimit, publicUnsubscribeNewsletter);
router.post("/contact", publicFormLimit, publicCreateContactRequest);

router.post("/chat/session", publicFormLimit, publicStartSiteChat);
router.get("/chat/session/:token", publicGetSiteChat);
router.post("/chat/session/:token/messages", publicChatMessageLimit, publicSendSiteChatMessage);

router.get("/billing/catalog", getBillingCatalogPublic);

// WhatsApp / mobile-web storefront (no auth)
router.get("/store/:code", publicGetStore);
router.get("/store/:code/catalog", publicGetStoreCatalog);
router.get("/store/:code/products/:productId", publicGetStoreProduct);
router.post("/store/:code/otp/send", otpSendLimit, publicSendStorefrontOtp);
router.post("/store/:code/otp/verify", credentialCheckLimit, publicVerifyStorefrontOtp);
router.post("/store/:code/orders", publicFormLimit, publicCreateStorefrontOrder);
router.post("/store/:code/orders/:orderId/payments/verify", publicFormLimit, publicVerifyStorefrontOrderPayment);

export default router;
