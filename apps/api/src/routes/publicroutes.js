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

const router = express.Router();

router.post("/newsletter/subscribe", publicSubscribeNewsletter);
router.post("/newsletter/unsubscribe", publicUnsubscribeNewsletter);
router.post("/contact", publicCreateContactRequest);

router.post("/chat/session", publicStartSiteChat);
router.get("/chat/session/:token", publicGetSiteChat);
router.post("/chat/session/:token/messages", publicSendSiteChatMessage);

router.get("/billing/catalog", getBillingCatalogPublic);

// WhatsApp / mobile-web storefront (no auth)
router.get("/store/:code", publicGetStore);
router.get("/store/:code/catalog", publicGetStoreCatalog);
router.get("/store/:code/products/:productId", publicGetStoreProduct);
router.post("/store/:code/otp/send", publicSendStorefrontOtp);
router.post("/store/:code/otp/verify", publicVerifyStorefrontOtp);
router.post("/store/:code/orders", publicCreateStorefrontOrder);
router.post("/store/:code/orders/:orderId/payments/verify", publicVerifyStorefrontOrderPayment);

export default router;
