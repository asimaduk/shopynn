import express from "express";
import {
    getAllRoles,
    getRoleById,
    getRolePermissions,
    createRole,
    updateRole,
    deleteRole,
    addPermissionToRole,
    removePermissionFromRole,
    setRolePermissions,
} from "../controllers/role.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission, requireAnyPermission } from "../middleware/requirePermission.js";

const router = express.Router();

// Reading roles is needed to assign one when adding staff; changing roles is a Business feature.
const canReadRoles = requireAnyPermission("roles.view", "users.roles.view", "users.view", "users.create", "users.update");
const canChangeRoles = [requireFeature("roles.update"), requirePermission("roles.update")];

router.get("/", canReadRoles, getAllRoles);
router.get("/:id/permissions", canReadRoles, getRolePermissions);
router.get("/:id", canReadRoles, getRoleById);
router.post("/", requireFeature("roles.create"), requirePermission("roles.create"), createRole);
router.put("/:id", ...canChangeRoles, updateRole);
router.delete("/:id", requireFeature("roles.delete"), requirePermission("roles.delete"), deleteRole);
router.post("/:id/permissions", ...canChangeRoles, addPermissionToRole);
router.delete("/:id/permissions/:permissionId", ...canChangeRoles, removePermissionFromRole);
router.put("/:id/permissions", ...canChangeRoles, setRolePermissions);

export default router;
