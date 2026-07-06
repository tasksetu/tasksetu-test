import express from 'express';
import {
  getAllLicenses,
  getLicenseByCode,
  getAllFeatures,
  getCurrentSubscription,
  getOrganizationFeatures,
  upgradeSubscription,
  downgradeSubscription,
  initializeTrial,
  cancelSubscription,
  purchaseAdditionalSeats,
  getSeatUsageSummary,
  getInvoices,
  getInvoiceById,
  downloadInvoice,
  validateDowngrade,
  validateCoupon,
  getCurrentLicense,        // 🆕 NEW
  getFeatureAccessMap,      // 🆕 NEW
  overrideLicense,          // 🆕 NEW
  // 🆕 NEW USER-LEVEL LICENSE MANAGEMENT
  getUserLicenseInfo,
  getCompanyLicensePool,
  assignLicenseToUser,
  unassignLicenseFromUser,
  checkCanAssignLicense,
  checkDowngradeEligibility,
  validateLicenseChange,    // 🆕 NEW v3
  getOrganizationUsersWithLicenses,
} from '../controllers/licenseController.js';
import {
  getLicensePoolStatus,
  getOrganizationLicensePool,
} from '../controllers/licensePoolController.js';
import { roleAuth, authenticateToken } from '../middleware/roleAuth.js';

const router = express.Router();

/**
 * Public Routes (no auth required)
 */

// Get all available licenses
router.get('/licenses', getAllLicenses);

// Get license details by code
router.get('/licenses/:licenseCode', getLicenseByCode);

// Get all features
router.get('/features', getAllFeatures);

/**
 * 🆕 NEW ENDPOINTS - License Rule Engine (USER-LEVEL)
 */

// Get current user's license and usage (all roles)
router.get(
  '/current',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'employee', 'individual', 'super_admin']),
  getCurrentLicense
);

// Get feature access map (all roles)
router.get(
  '/features-access',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'employee', 'individual', 'super_admin']),
  getFeatureAccessMap
);

// 🆕 Get specific user's license info (Primary Admin/Super Admin only)
router.get(
  '/user/:userId',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  getUserLicenseInfo
);

/**
 * 🆕 USER-LEVEL LICENSE MANAGEMENT (Primary Admin Only)
 */

// Get company's license pool summary
router.get(
  '/organization/pool',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  getCompanyLicensePool
);

// Get all users in organization with their licenses
router.get(
  '/organization/users',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  getOrganizationUsersWithLicenses
);

// Assign license from pool to user
router.post(
  '/assign',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  assignLicenseToUser
);

// Release user's license back to pool
router.post(
  '/unassign',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  unassignLicenseFromUser
);

// Check if license can be assigned (for UI validation)
router.post(
  '/check-assign',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  checkCanAssignLicense
);

// Validate license change (upgrade/downgrade) - checks usage against limits
router.post(
  '/validate-change',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  validateLicenseChange
);

// Check downgrade eligibility
router.post(
  '/check-downgrade',
  authenticateToken,
  roleAuth(['org_admin', 'super_admin']),
  checkDowngradeEligibility
);

/**
 * Protected Routes (require authentication)
 */

// Get license pool status for organization (DEPRECATED - use /organization/pool)
router.get(
  '/organization/license-pool',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'employee', 'individual']),
  getOrganizationLicensePool
);

// Get global license pool status (super admin only)
router.get(
  '/license-pool',
  authenticateToken,
  roleAuth(['super_admin']),
  getLicensePoolStatus
);

// Get current organization subscription
router.get(
  '/organization/subscription',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'employee', 'individual']),
  getCurrentSubscription
);

// Get organization features with usage stats
router.get(
  '/organization/features',
  authenticateToken,
  roleAuth(['org_admin', 'manager', 'employee', 'individual']),
  getOrganizationFeatures
);

// Get seat usage summary
router.get(
  '/organization/subscription/seats',
  authenticateToken,
  roleAuth(['org_admin', 'manager']),
  getSeatUsageSummary
);

/**
 * Billing & Invoices Routes
 */

// Get invoices (billing history)
router.get(
  '/organization/invoices',
  authenticateToken,
  roleAuth(['org_admin', 'individual']),
  getInvoices
);

// Get single invoice by ID
router.get(
  '/organization/invoices/:invoiceId',
  authenticateToken,
  roleAuth(['org_admin', 'individual']),
  getInvoiceById
);

// Download invoice PDF data
router.get(
  '/organization/invoices/:invoiceId/download',
  authenticateToken,
  roleAuth(['org_admin', 'individual']),
  downloadInvoice
);

/**
 * Upgrade/Downgrade Routes
 */

// Validate coupon code
router.post(
  '/validate-coupon',
  authenticateToken,
  roleAuth(['org_admin', 'individual']),
  validateCoupon
);

// Validate downgrade before proceeding
router.post(
  '/organization/subscription/validate-downgrade',
  authenticateToken,
  roleAuth(['org_admin']),
  validateDowngrade
);

// Purchase additional seats (org_admin only)
router.post(
  '/organization/subscription/purchase-seats',
  authenticateToken,
  roleAuth(['org_admin']),
  purchaseAdditionalSeats
);

// Upgrade subscription (org_admin only)
router.post(
  '/organization/subscription/upgrade',
  authenticateToken,
  roleAuth(['org_admin']),
  upgradeSubscription
);

// Downgrade subscription (org_admin only)
router.post(
  '/organization/subscription/downgrade',
  authenticateToken,
  roleAuth(['org_admin']),
  downgradeSubscription
);

// Cancel subscription (org_admin only)
router.post(
  '/organization/subscription/cancel',
  authenticateToken,
  roleAuth(['org_admin']),
  cancelSubscription
);

/**
 * Admin Routes (for system setup)
 */

// Initialize trial subscription for new organization
router.post('/subscription/initialize-trial', initializeTrial);

/**
 * 🆕 Super Admin Routes
 */

// Override license for any user/organization (super admin only)
router.post(
  '/admin/override',
  authenticateToken,
  roleAuth(['super_admin']),
  overrideLicense
);

export default router;
