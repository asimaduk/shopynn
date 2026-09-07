import express from "express";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import { requirePermission, requireAnyPermission } from "../middleware/requirePermission.js";
import {
    getBillingCatalog,
    updateBillingCatalogItem,
    createBillingCatalogItem,
    getBillingCatalogItem,
} from "../controllers/billing.js";

const router = express.Router();

const catalogRead = [
    auth,
    requireAnyPermission(
        "tenants.directory.view",
        "merchants.operate",
        "merchants.view",
        "subscription.view"
    ),
];

router.get("/catalog", ...catalogRead, getBillingCatalog);

router.get(
    "/catalog/:id",
    auth,
    requirePermission("tenants.directory.view"),
    requireActiveSubscription,
    getBillingCatalogItem
);

router.patch(
    "/catalog/:id",
    auth,
    requireActiveSubscription,
    requirePermission("tenants.directory.view"),
    updateBillingCatalogItem
);

router.post(
    "/catalog",
    auth,
    requireActiveSubscription,
    requirePermission("tenants.directory.view"),
    createBillingCatalogItem
);

export default router;
