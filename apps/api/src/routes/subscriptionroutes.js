import express from "express";
import { activateSubscription, getCurrentSubscription, onboardSubscription } from "../controllers/subscription.js";

const router = express.Router();

router.post("/onboard", onboardSubscription);
router.put("/:id/activate", activateSubscription);
router.get("/current", getCurrentSubscription);

export default router;
