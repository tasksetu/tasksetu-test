import express from "express";
import { getTaskCounts, getOverdueTasks } from "../controller/dashboardController.js";
import { authenticateToken, roleAuth } from "../middleware/roleAuth.js";
import { checkFeatureAccess } from "../middleware/licenseMiddleware.js";

const router = express.Router();

router.get("/task-counts", authenticateToken,
  roleAuth(["org_admin", 'individual']), getTaskCounts);

router.get("/overdue", authenticateToken,
  roleAuth(["org_admin", 'individual', 'manager', 'employee']), getOverdueTasks);

export default router;
