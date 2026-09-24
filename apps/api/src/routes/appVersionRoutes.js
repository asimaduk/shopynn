import express from "express";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
    createAppVersion,
    updateAppVersion,
    getAppVersions,
    checkAppVersionStatus,
} from "../controllers/appVersion.js";

const router = express.Router();

// Public check endpoint for apps (pre/post-login).
router.get("/check", checkAppVersionStatus);

// Platform-admin management
const requirePlatformAdmin = [
    auth,
    requireActiveSubscription,
    requirePermission("tenants.directory.view"),
];

router.get("/", ...requirePlatformAdmin, getAppVersions);
router.post("/", ...requirePlatformAdmin, createAppVersion);
router.put("/:id", ...requirePlatformAdmin, updateAppVersion);

export default router;
