import express from "express";
import { getMyPermissions, getMyRoles } from "../controllers/userRole.js";

const router = express.Router();

router.get("/me/permissions", getMyPermissions);
router.get("/me/roles", getMyRoles);

export default router;
