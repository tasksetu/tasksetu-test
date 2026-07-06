/**
 * 🎯 LICENSE API ROUTES
 * All license-related endpoints for different user roles
 * 
 * Route Structure:
 * - /api/license/*        - Common license APIs (all authenticated users)
 * - /api/billing/*        - Billing APIs (org admin only)
 * - /api/super-admin/*    - Super admin APIs (defined in superAdminRoutes.js)
 */

import express from 'express';
import {
    getCurrentLicense,
    getFeatureAccessMap,
    getUsageSummary,
    upgradeLicense,
    getBillingInvoices,
    updateBillingDetails
} from '../controllers/licenseApiController.js';
import { authenticateToken, roleAuth } from '../middleware/roleAuth.js';

const router = express.Router();

// ============================================================================
// 🔹 COMMON LICENSE APIs (All Authenticated Users)
// ============================================================================

/**
 * GET /api/license/current
 * Returns complete license info + usage for current user/company
 * Auth: Required (any logged-in user)
 */
router.get('/current', authenticateToken, getCurrentLicense);

/**
 * GET /api/license/features
 * Returns feature access map (for frontend locks/buttons)
 * Auth: Required (any logged-in user)
 */
router.get('/features', authenticateToken, getFeatureAccessMap);

/**
 * GET /api/license/usage/summary
 * Returns lightweight usage summary (for header widgets)
 * Auth: Required (any logged-in user)
 */
router.get('/usage/summary', authenticateToken, getUsageSummary);

// ============================================================================
// 🔹 ORG ADMIN APIs
// ============================================================================

/**
 * POST /api/license/upgrade
 * Upgrade/downgrade license plan
 * Auth: Required (admin role for organizations, any user for individual accounts)
 */
router.post('/upgrade', authenticateToken, upgradeLicense);

// ============================================================================
// 🔹 BILLING APIs (Org Admin)
// ============================================================================

/**
 * GET /api/billing/invoices
 * Get billing history
 * Auth: Required (org members only)
 */
router.get('/billing/invoices', authenticateToken, getBillingInvoices);

/**
 * PUT /api/billing/update
 * Update billing details (payment method, billing contact, tax info)
 * Auth: Required (org admin or individual users)
 */
router.put('/billing/update', authenticateToken, updateBillingDetails);

/**
 * GET /api/billing/invoices/:invoiceId/download
 * Download specific invoice (placeholder)
 * Auth: Required (org admin only)
 */
router.get('/billing/invoices/:invoiceId/download', authenticateToken, roleAuth('admin'), (req, res) => {
    // TODO: Implement PDF generation
    res.status(501).json({
        success: false,
        message: 'Invoice download not yet implemented'
    });
});

export default router;
