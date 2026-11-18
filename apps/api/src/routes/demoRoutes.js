import express from "express";
import { enterDemo } from "../controllers/demo.js";
import { demoEnterLimit } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/enter", demoEnterLimit, enterDemo);

export default router;
