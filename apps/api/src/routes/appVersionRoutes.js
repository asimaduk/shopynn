import express from "express";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import {
    createAppVersion,
    getAppVersions,
    checkAppVersionStatus,
} from "../controllers/appVersion.js";

const router = express.Router();

// Public check endpoint for apps (pre/post-login).
router.get("/check", checkAppVersionStatus);

// Management endpoints
router.get("/", auth, requireActiveSubscription, getAppVersions);
router.post("/", auth, requireActiveSubscription, createAppVersion);

export default router;

