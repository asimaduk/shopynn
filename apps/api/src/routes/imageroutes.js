import express from "express";
import { getImage, saveImage, uploadImages } from "../controllers/image.js";

const router = express.Router();

router.post('/',uploadImages.any(), saveImage);

router.get('/', getImage);

export default router;