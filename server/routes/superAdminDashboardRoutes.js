import express from "express";
import { superAdminDashboardController } from "../controller/superAdminDashboardController.js";
import { requireSuperAdmin } from "../middleware/superAdminAuth.js";
import { authenticateToken } from "../middleware/roleAuth.js";

const router = express.Router();

// GET /api/super-admin/dashboard
router.get("/dashboard", authenticateToken, requireSuperAdmin, superAdminDashboardController.dashboard);

// GET /api/super-admin/analytics
router.get("/analytics", authenticateToken, requireSuperAdmin, superAdminDashboardController.getAnalytics);

// GET /api/super-admin/export-analytics
router.get("/export-analytics", authenticateToken, requireSuperAdmin, superAdminDashboardController.exportAnalytics);

export default router;
