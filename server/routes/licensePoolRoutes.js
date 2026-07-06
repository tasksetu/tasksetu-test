import express from 'express';
import {
  purchaseBulkLicenses,
  getLicenseInventory,
  getAvailableLicenses,
  getAssignedLicenses,
  getLicenseDetails,
} from '../controllers/licensePoolManagementController.js';
import {
  assignUserLicense,
  getUserLicense,
  bulkAssignLicenses,
} from '../controllers/userLicenseController.js';
import { roleAuth, authenticateToken } from '../middleware/roleAuth.js';

const router = express.Router();

/**
 * 🔹 LICENSE POOL MANAGEMENT ROUTES
 * For managing organization's license inventory
 */

// Purchase bulk licenses (org admin only)
router.post(
  '/licenses/purchase',
  authenticateToken,
  roleAuth(['org_admin']),
  purchaseBulkLicenses
);

// Get license inventory summary (all authenticated users)
router.get(
  '/licenses/inventory',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'employee', 'individual', 'super_admin']),
  getLicenseInventory
);

// Get available licenses (org admin and managers)
router.get(
  '/licenses/available',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'super_admin']),
  getAvailableLicenses
);

// Get assigned licenses (org admin and managers)
router.get(
  '/licenses/assigned',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'super_admin']),
  getAssignedLicenses
);

// Get specific license details (org admin and managers)
router.get(
  '/licenses/:licenseId/details',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'super_admin']),
  getLicenseDetails
);

/**
 * 🔹 USER LICENSE ASSIGNMENT ROUTES
 * For assigning/managing licenses for individual users
 */

// Get user's license information
router.get(
  '/users/:userId/license',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'employee', 'individual', 'super_admin']),
  getUserLicense
);

// Assign/change/remove user's license (org admin only)
router.put(
  '/users/:userId/license',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  assignUserLicense
);

// Bulk assign licenses to multiple users (org admin only)
router.post(
  '/users/bulk-assign-licenses',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  bulkAssignLicenses
);

export default router;
