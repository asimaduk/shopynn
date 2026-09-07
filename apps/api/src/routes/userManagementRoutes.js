import express from "express";
import {
    getMyPermissions,
    getMyRoles,
    getUsersWithRoles,
    getUserRoles,
    assignRole,
    removeRole,
    setUserRoles,
} from "../controllers/userRole.js";

const router = express.Router();

router.get("/me/permissions", getMyPermissions);
router.get("/me/roles", getMyRoles);
router.get("/users", getUsersWithRoles);
router.get("/users/:userId/roles", getUserRoles);
router.post("/users/:userId/roles", assignRole);
router.delete("/users/:userId/roles/:roleId", removeRole);
router.put("/users/:userId/roles", setUserRoles);

export default router;
