import express from "express";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { getBroadcastAudienceCounts, sendBroadcast } from "../controllers/broadcast.js";

const router = express.Router();

/** Platform operators only (not tenant Super Admin). */
const PLATFORM_DIR = "tenants.directory.view";
const BROADCAST = "broadcasts.send";

router.get(
    "/audience",
    auth,
    requireActiveSubscription,
    requireFeature(PLATFORM_DIR),
    requirePermission(PLATFORM_DIR),
    requirePermission(BROADCAST),
    getBroadcastAudienceCounts
);

router.post(
    "/send",
    auth,
    requireActiveSubscription,
    requireFeature(PLATFORM_DIR),
    requirePermission(PLATFORM_DIR),
    requirePermission(BROADCAST),
    sendBroadcast
);

export default router;
