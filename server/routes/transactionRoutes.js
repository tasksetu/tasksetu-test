import express from 'express';
import {
    getOrganizationTransactions,
    getTransactionById,
    createTransaction,
    completeTransaction,
    failTransaction,
    refundTransaction,
    searchTransactions,
    getTransactionStats,
} from '../controllers/transactionController.js';
import { authenticateToken, roleAuth } from '../middleware/roleAuth.js';

const router = express.Router();

/**
 * All transaction history routes require authentication
 * Only org_admin, individual, and super_admin can view transactions
 */

// Get all transactions for organization (paginated)
router.get(
    '/organization',
    authenticateToken,
    roleAuth(['org_admin', 'individual', 'super_admin']),
    getOrganizationTransactions
);

// Get transaction statistics
router.get(
    '/stats',
    authenticateToken,
    roleAuth(['org_admin', 'individual', 'super_admin']),
    getTransactionStats
);

// Search transactions
router.get(
    '/search',
    authenticateToken,
    roleAuth(['org_admin', 'individual', 'super_admin']),
    searchTransactions
);

// Get specific transaction by ID
router.get(
    '/:transactionId',
    authenticateToken,
    roleAuth(['org_admin', 'individual', 'super_admin']),
    getTransactionById
);

// Create new transaction (when purchase is initiated)
router.post(
    '/create',
    authenticateToken,
    roleAuth(['org_admin', 'individual', 'super_admin']),
    createTransaction
);

// Mark transaction as completed (after successful Razorpay payment)
router.put(
    '/:transactionId/complete',
    authenticateToken,
    roleAuth(['org_admin', 'individual', 'super_admin']),
    completeTransaction
);

// Mark transaction as failed
router.put(
    '/:transactionId/fail',
    authenticateToken,
    roleAuth(['org_admin', 'individual', 'super_admin']),
    failTransaction
);

// Process refund
router.post(
    '/:transactionId/refund',
    authenticateToken,
    roleAuth(['org_admin', 'individual', 'super_admin']),
    refundTransaction
);

export default router;
