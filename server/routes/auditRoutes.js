/**
 * @file auditRoutes.js
 * @desc Routes for audit log management (Spec 5.12)
 * @author TaskSetu Development Team
 * @version 1.0.0
 * 
 * All routes require authentication and org_admin/super_admin role
 */

import express from 'express';
import {
  getAuditReport,
  getAuditLogById,
  archiveExpiredLogs,
  exportAuditLogs
} from '../controller/auditController.js';
import { authenticateToken, requireRole } from '../middleware/roleAuth.js';

const router = express.Router();

/**
 * @route GET /api/audit-logs/report
 * @desc Generate filtered audit report with pagination
 * @access Org Admin, Super Admin
 */
router.get(
  '/report',
  authenticateToken,
  requireRole(['org_admin', 'super_admin']),
  getAuditReport
);

/**
 * @route GET /api/audit-logs/export
 * @desc Export audit logs to CSV for compliance
 * @access Org Admin, Super Admin
 */
router.get(
  '/export',
  authenticateToken,
  requireRole(['org_admin', 'super_admin']),
  exportAuditLogs
);

/**
 * @route GET /api/audit-logs/:log_id
 * @desc Get detailed audit log entry
 * @access Org Admin, Super Admin
 */
router.get(
  '/:log_id',
  authenticateToken,
  requireRole(['org_admin', 'super_admin']),
  getAuditLogById
);

/**
 * @route POST /api/audit-logs/archive
 * @desc Manually trigger archival of expired logs
 * @access Super Admin only
 */
router.post(
  '/archive',
  authenticateToken,
  requireRole(['super_admin']),
  archiveExpiredLogs
);

export default router;
