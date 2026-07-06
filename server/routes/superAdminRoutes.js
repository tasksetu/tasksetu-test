import express from "express";
import { superAdminController } from "../controller/superAdminController.js";
import { requireSuperAdmin } from "../middleware/superAdminAuth.js";
import { authenticateToken } from "../middleware/roleAuth.js";

const router = express.Router();

router.get("/test", superAdminController.test);
router.get("/analytics", authenticateToken, requireSuperAdmin, superAdminController.analytics);
router.get("/companies", superAdminController.companies);
router.get("/companies/:id", authenticateToken, requireSuperAdmin, superAdminController.companyById);
router.patch("/companies/:id/status", authenticateToken, requireSuperAdmin, superAdminController.updateCompanyStatus);
router.get("/users", superAdminController.users);
router.get("/users/:id", authenticateToken, requireSuperAdmin, superAdminController.userById);
router.post("/create-super-admin", authenticateToken, requireSuperAdmin, superAdminController.createSuperAdmin);
router.get("/logs", authenticateToken, requireSuperAdmin, superAdminController.logs);
router.post("/assign-admin", authenticateToken, requireSuperAdmin, superAdminController.assignAdmin);

// Feature Flags Routes
router.get("/feature-flags", authenticateToken, requireSuperAdmin, superAdminController.getFeatureFlags);
router.patch("/feature-flags/:flagName", authenticateToken, requireSuperAdmin, superAdminController.toggleFeatureFlag);

// System Configuration Routes
router.get("/config", authenticateToken, requireSuperAdmin, superAdminController.getSystemConfigs);
router.post("/config", authenticateToken, requireSuperAdmin, superAdminController.updateSystemConfig);

// Audit & Compliance Routes
router.get("/audit-logs", authenticateToken, requireSuperAdmin, superAdminController.getAuditLogs);
router.get("/audit-logs/export", authenticateToken, requireSuperAdmin, superAdminController.exportAuditLogs);

// System Health Routes
router.get("/health", authenticateToken, requireSuperAdmin, superAdminController.getSystemHealth);
router.get("/notification-health", authenticateToken, requireSuperAdmin, superAdminController.getNotificationHealth);

// Support & Operations Routes
router.get("/error-logs", authenticateToken, requireSuperAdmin, superAdminController.getErrorLogs);
router.get("/failed-jobs", authenticateToken, requireSuperAdmin, superAdminController.getFailedJobs);
router.get("/abuse-alerts", authenticateToken, requireSuperAdmin, superAdminController.getAbuseAlerts);

export default router;
