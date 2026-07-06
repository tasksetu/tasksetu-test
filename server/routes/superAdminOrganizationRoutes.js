import express from 'express';
import {
  searchOrganizations,
  getOrganizationDetails,
  overrideLicense,
  extendTrial,
  suspendLicense,
  overrideFeatureFlags,
  exportOrganizations,
  getAuditLogs
} from '../controllers/superAdminOrganizationController.js';
import { authenticateToken, roleAuth } from '../middleware/roleAuth.js';

const router = express.Router();

// All routes require authentication and super_admin role
router.use(authenticateToken);
router.use(roleAuth(['super_admin']));

// Search organizations
router.get('/organizations/search', searchOrganizations);

// Get organization details
router.get('/organizations/:orgId', getOrganizationDetails);

// Override license
router.post('/organizations/:orgId/override-license', overrideLicense);

// Extend trial
router.post('/organizations/:orgId/extend-trial', extendTrial);

// Suspend/Reactivate license
router.post('/organizations/:orgId/suspend', suspendLicense);

// Override feature flags
router.post('/organizations/:orgId/feature-flags', overrideFeatureFlags);

// Export organizations
router.get('/export/organizations', exportOrganizations);

// Get audit logs
router.get('/audit-logs', getAuditLogs);

export default router;
