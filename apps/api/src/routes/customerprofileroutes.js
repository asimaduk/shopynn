import express from "express";
import {
    getCustomerStores,
    linkCustomerStore,
    signupCustomerProfile,
} from "../controllers/customerProfile.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.post(
    "/signup",
    requireFeature("orders.create"),
    requirePermission("orders.create"),
    signupCustomerProfile
);
router.post(
    "/link-store",
    requireFeature("orders.update"),
    requirePermission("orders.update"),
    linkCustomerStore
);
router.get(
    "/stores",
    requireFeature("orders.view"),
    requirePermission("orders.view"),
    getCustomerStores
);

export default router;
