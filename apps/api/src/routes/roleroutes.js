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

const router = express.Router();

router.get("/", getAllRoles);
router.get("/:id/permissions", getRolePermissions);
router.get("/:id", getRoleById);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);
router.post("/:id/permissions", addPermissionToRole);
router.delete("/:id/permissions/:permissionId", removePermissionFromRole);
router.put("/:id/permissions", setRolePermissions);

export default router;
