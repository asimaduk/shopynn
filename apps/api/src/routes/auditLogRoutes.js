import express from "express";
import { getAuditLogs } from "../controllers/auditLog.js";
import requireFeature from "../middleware/requireFeature.js";
import { requireAnyPermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.get("/", requireFeature("audit_logs.view"), requireAnyPermission("audit_logs.view", "audit.view"), getAuditLogs);

export default router;
