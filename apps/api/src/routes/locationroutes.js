import express from "express";
import { createLocation, getAllLocations, getLocationById, updateLocation } from "../controllers/location.js";
import { requirePermission } from "../middleware/requirePermission.js";
const router = express.Router();

router.post("/", requirePermission("locations.create"), createLocation);
router.get("/", requirePermission("locations.view"), getAllLocations);
router.put("/:id", requirePermission("locations.update"), updateLocation);
router.get("/:id", requirePermission("locations.view"), getLocationById);

export default router;