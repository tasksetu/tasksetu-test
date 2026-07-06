import express from 'express';
import { 
  getAllLicensePlans,
  createLicensePlan,
  updateLicensePlan,
  deleteLicensePlan,
  togglePlanStatus,
  getLicenseAnalytics,
  getPlanSubscribers,
  bulkUpdatePricing,
  getAllFeatures,
  getPlanFeatures,
  updatePlanFeatures,
  toggleFeatureActive
} from '../controllers/superAdminLicenseController.js';
import { authenticateToken, roleAuth } from '../middleware/roleAuth.js';

const router = express.Router();

/**
 * Super Admin License Management Routes
 * All routes require super_admin role
 */

// Get all license plans with statistics
router.get(
  '/license-plans',
  authenticateToken,
  roleAuth(['super_admin']),
  getAllLicensePlans
);

// Get license analytics and revenue data
router.get(
  '/license-analytics',
  authenticateToken,
  roleAuth(['super_admin']),
  getLicenseAnalytics
);

// Get subscribers for a specific plan
router.get(
  '/license-plans/:planId/subscribers',
  authenticateToken,
  roleAuth(['super_admin']),
  getPlanSubscribers
);

// Create new license plan
router.post(
  '/license-plans',
  authenticateToken,
  roleAuth(['super_admin']),
  createLicensePlan
);

// Update existing license plan
router.put(
  '/license-plans/:planId',
  authenticateToken,
  roleAuth(['super_admin']),
  updateLicensePlan
);

// Toggle plan active/inactive status
router.patch(
  '/license-plans/:planId/toggle-status',
  authenticateToken,
  roleAuth(['super_admin']),
  togglePlanStatus
);

// Delete license plan
router.delete(
  '/license-plans/:planId',
  authenticateToken,
  roleAuth(['super_admin']),
  deleteLicensePlan
);

// Bulk update pricing for multiple plans
router.post(
  '/license-plans/bulk-update-pricing',
  authenticateToken,
  roleAuth(['super_admin']),
  bulkUpdatePricing
);

// Get all features
router.get(
  '/features',
  authenticateToken,
  roleAuth(['super_admin']),
  getAllFeatures
);

// Get features for a specific plan
router.get(
  '/license-plans/:planId/features',
  authenticateToken,
  roleAuth(['super_admin']),
  getPlanFeatures
);

// Update features for a specific plan
router.post(
  '/license-plans/:planId/features',
  authenticateToken,
  roleAuth(['super_admin']),
  updatePlanFeatures
);

// Toggle feature active status
router.patch(
  '/features/:featureCode/toggle-active',
  authenticateToken,
  roleAuth(['super_admin']),
  toggleFeatureActive
);

export default router;
