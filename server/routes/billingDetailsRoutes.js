import express from 'express';
import {
    getBillingDetails,
    createBillingDetails,
    updateBillingDetails,
    deleteBillingDetails,
    getBillingDetailsById,
    setDefaultBillingDetails
} from '../controllers/billingDetailsController.js';
import { authenticateToken, requireRole } from '../middleware/roleAuth.js';

const router = express.Router();

/**
 * All billing details routes require authentication
 * Only org_admin, individual, and super_admin can manage billing details
 */

// Get all billing details for organization
router.get(
    '/',
    authenticateToken,
    requireRole(['org_admin', 'individual', 'super_admin']),
    getBillingDetails
);

// Create new billing details
router.post(
    '/',
    authenticateToken,
    requireRole(['org_admin', 'individual', 'super_admin']),
    createBillingDetails
);

// Get single billing details
router.get(
    '/:billingDetailsId',
    authenticateToken,
    requireRole(['org_admin', 'individual', 'super_admin']),
    getBillingDetailsById
);

// Update billing details
router.put(
    '/:billingDetailsId',
    authenticateToken,
    requireRole(['org_admin', 'individual', 'super_admin']),
    updateBillingDetails
);

// Delete billing details
router.delete(
    '/:billingDetailsId',
    authenticateToken,
    requireRole(['org_admin', 'individual', 'super_admin']),
    deleteBillingDetails
);

// Set as default
router.post(
    '/:billingDetailsId/set-default',
    authenticateToken,
    requireRole(['org_admin', 'individual', 'super_admin']),
    setDefaultBillingDetails
);

export default router;
