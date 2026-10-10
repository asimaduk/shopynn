import express from "express";
import { getAllPermissions, getPermissionById } from "../controllers/permission.js";
import { requireAnyPermission } from "../middleware/requirePermission.js";

const router = express.Router();

const canReadPermissions = requireAnyPermission("permissions.view", "roles.view", "users.roles.view", "users.create", "users.update");

router.get("/", canReadPermissions, getAllPermissions);
router.get("/:id", canReadPermissions, getPermissionById);

export default router;
