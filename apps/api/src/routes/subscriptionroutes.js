import express from "express";
import { getCurrentSubscription, onboardSubscription } from "../controllers/subscription.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.post("/onboard", requirePermission("subscription.manage"), onboardSubscription);
router.get("/current", getCurrentSubscription);

export default router;
