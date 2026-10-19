import express from "express";
import { getTaskCounts, getOverdueTasks, getAggregatedDashboard } from "../controller/dashboardController.js";
import { authenticateToken, roleAuth } from "../middleware/roleAuth.js";
import { checkFeatureAccess } from "../middleware/licenseMiddleware.js";

const router = express.Router();

// Single consolidated aggregated dashboard endpoint for all roles
router.get("/aggregated", authenticateToken, getAggregatedDashboard);

router.get("/task-counts", authenticateToken,
  roleAuth(["org_admin", 'individual']), getTaskCounts);

router.get("/overdue", authenticateToken,
  roleAuth(["org_admin", 'individual', 'manager', 'employee']), getOverdueTasks);

export default router;
