import express from "express";
import { getAllPermissions, getPermissionById } from "../controllers/permission.js";

const router = express.Router();

router.get("/", getAllPermissions);
router.get("/:id", getPermissionById);

export default router;
