import express from "express";
import { getImage, saveImage, uploadImages } from "../controllers/image.js";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import { uploadLimit } from "../middleware/rateLimit.js";
import { blockDemoSensitive } from "../middleware/blockDemoSensitive.js";

const router = express.Router();

router.post('/', auth, requireActiveSubscription, uploadLimit, blockDemoSensitive, uploadImages.any(), saveImage);

router.get('/', getImage);

export default router;
