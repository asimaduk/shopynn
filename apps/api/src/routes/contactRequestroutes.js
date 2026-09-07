import express from "express";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
    listContactRequests,
    getContactRequest,
    updateContactRequest,
    replyToContactRequest,
} from "../controllers/contactRequest.js";

const router = express.Router();

router.get(
    "/",
    auth,
    requireActiveSubscription,
    requireFeature("contact_requests.view"),
    requirePermission("contact_requests.view"),
    listContactRequests
);
router.get(
    "/:id",
    auth,
    requireActiveSubscription,
    requireFeature("contact_requests.view"),
    requirePermission("contact_requests.view"),
    getContactRequest
);
router.patch(
    "/:id",
    auth,
    requireActiveSubscription,
    requireFeature("contact_requests.view"),
    requirePermission("contact_requests.view"),
    updateContactRequest
);
router.post(
    "/:id/reply",
    auth,
    requireActiveSubscription,
    requireFeature("contact_requests.respond"),
    requirePermission("contact_requests.respond"),
    replyToContactRequest
);

export default router;
