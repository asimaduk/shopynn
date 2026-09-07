import express from "express";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import {
    createIndustry,
    getIndustries,
    getIndustryById,
} from "../controllers/industry.js";

const router = express.Router();

router.get("/", auth, requireActiveSubscription, getIndustries);
router.get("/:id", auth, requireActiveSubscription, getIndustryById);
router.post("/", auth, requireActiveSubscription, createIndustry);

export default router;

