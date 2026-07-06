import { TransactionHistory } from '../modals/transactionHistoryModal.js';
import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';
import { License } from '../modals/licenseModal.js';
import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';

/**
 * GET /api/transaction-history/organization
 * Get all transaction history for the authenticated user's organization
 * Only org_admin, individual, and super_admin can view
 * ✅ NEW: Groups multiple items purchased in same order into a single transaction
 */
export const getOrganizationTransactions = async (req, res) => {
    try {
        const organizationId = req.user?.organizationId || req.user?.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status || null;

        const isIndividual = req.user.role === 'individual' || (Array.isArray(req.user.role) && req.user.role.includes('individual'));

        if (!organizationId && !isIndividual) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID not found',
            });
        }

        // Build query - Support both organization and individual users
        const query = organizationId ? { organization_id: organizationId } : { user_id: userId };
        if (status) {
            query.status = status.toUpperCase();
        }

        // Get total count
        const totalCount = await TransactionHistory.countDocuments(query);

        // ✅ NEW: Fetch and group transactions
        // Get raw transactions sorted by date
        const transactions = await TransactionHistory.find(query)
            .populate('user_id', 'name email firstName lastName')
            .populate('organization_id', 'name')
            .sort({ transaction_date: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // ✅ Group transactions by order_group_id
        const groupedTransactions = [];
        const processedGroups = new Set();

        for (const txn of transactions) {
            const groupId = txn.order_group_id || txn.razorpay_order_id || txn._id.toString();

            if (processedGroups.has(groupId.toString())) {
                continue; // Skip if already processed as part of a group
            }

            if (txn.order_group_id) {
                // This transaction is part of a group - fetch all items in the group
                const groupItems = await TransactionHistory.find({
                    order_group_id: txn.order_group_id
                }).lean();

                if (groupItems.length > 0) {
                    // Create a consolidated transaction with items array
                    const consolidatedTxn = {
                        ...txn,
                        items: groupItems.map(item => ({
                            license_code: item.license_code,
                            license_name: item.license_name,
                            seats_purchased: item.seats_purchased,
                            billing_cycle: item.billing_cycle,
                            price_per_seat: item.price_per_seat,
                            total_price: item.total_price,
                        })),
                        // Populate user info
                        user_id: txn.user_id,
                        organization_id: txn.organization_id,
                    };
                    groupedTransactions.push(consolidatedTxn);
                    processedGroups.add(groupId.toString());
                }
            } else {
                // No group - use schema items[] if populated, else fallback to single-item
                const schemaItems = txn.items && txn.items.length > 0 ? txn.items : null;
                groupedTransactions.push({
                    ...txn,
                    items: schemaItems || [{
                        license_code: txn.license_code,
                        license_name: txn.license_name,
                        seats_purchased: txn.seats_purchased,
                        billing_cycle: txn.billing_cycle,
                        price_per_seat: txn.price_per_seat,
                        total_price: txn.total_price,
                    }],
                });
                processedGroups.add(groupId.toString());
            }
        }

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limit);

        return res.status(200).json({
            success: true,
            data: groupedTransactions,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalCount: totalCount,
                limit: limit,
            },
        });
    } catch (error) {
        console.error('❌ Error fetching organization transactions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction history',
            error: error.message,
        });
    }
};

/**
 * GET /api/transaction-history/:transactionId
 * Get a specific transaction by ID
 * ✅ NEW: Returns grouped items if part of an order group
 */
export const getTransactionById = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const organizationId = req.user?.organizationId || req.user?.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;

        let transaction = await TransactionHistory.findById(transactionId)
            .populate('user_id', 'name email firstName lastName')
            .populate('organization_id', 'name')
            .populate('coupon_id')
            .lean();

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        // Verify ownership
        const isOrgMatch = organizationId && transaction.organization_id && (transaction.organization_id._id || transaction.organization_id).toString() === organizationId.toString();
        const isUserMatch = userId && transaction.user_id && (transaction.user_id._id || transaction.user_id).toString() === userId.toString();

        if (!isOrgMatch && !isUserMatch) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to view this transaction',
            });
        }

        // ✅ If part of a group, fetch all items in the group
        if (transaction.order_group_id) {
            const groupItems = await TransactionHistory.find({
                order_group_id: transaction.order_group_id
            }).lean();

            transaction.items = groupItems.map(item => ({
                license_code: item.license_code,
                license_name: item.license_name,
                seats_purchased: item.seats_purchased,
                billing_cycle: item.billing_cycle,
                price_per_seat: item.price_per_seat,
                total_price: item.total_price,
            }));
        } else if (transaction.items && transaction.items.length > 0) {
            // Schema items[] already populated - use directly
            // (items already set via lean() so no override needed)
        } else {
            // Legacy single item transaction
            transaction.items = [{
                license_code: transaction.license_code,
                license_name: transaction.license_name,
                seats_purchased: transaction.seats_purchased,
                billing_cycle: transaction.billing_cycle,
                price_per_seat: transaction.price_per_seat,
                total_price: transaction.total_price,
            }];
        }

        return res.status(200).json({
            success: true,
            data: transaction,
        });
    } catch (error) {
        console.error('❌ Error fetching transaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction',
            error: error.message,
        });
    }
};

/**
 * POST /api/transaction-history/create
 * Create a new transaction record
 * Called when a user initiates a plan purchase (before Razorpay payment)
 */
export const createTransaction = async (req, res) => {
    try {
        const {
            license_code,
            license_name,
            seats_purchased,
            billing_cycle,
            price_per_seat,
            total_price,
            discount_code,
            discount_amount = 0,
            coupon_id = null,
            renewal_date,
        } = req.body;

        const organizationId = req.user?.organizationId || req.user?.organization_id;
        const userId = req.user?.id || req.user?._id || req.user?.userId;

        // Validation
        if (!organizationId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Organization and User ID required',
            });
        }

        if (!license_code || !license_name || !seats_purchased || !renewal_date) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
        }

        // Calculate final amount
        const final_amount = total_price - discount_amount;
        const tax_amount = Math.round(final_amount * 0.18); // 18% GST
        const amount_paid = final_amount + tax_amount;

        // Generate transaction ID
        const transaction_id = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create transaction record
        const transaction = await TransactionHistory.create({
            transaction_id,
            organization_id: organizationId,
            user_id: userId,
            license_code: license_code.toUpperCase(),
            license_name,
            seats_purchased,
            billing_cycle: billing_cycle.toUpperCase(),
            price_per_seat,
            total_price,
            discount_applied: discount_amount > 0,
            discount_code: discount_code || null,
            discount_amount,
            final_amount,
            tax_amount,
            tax_percentage: 18,
            amount_paid,
            payment_method: 'RAZORPAY',
            status: 'PENDING',
            renewal_date: new Date(renewal_date),
            coupon_id: coupon_id || null,
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.headers['user-agent'],
        });

        console.log(`✅ Transaction created: ${transaction._id}`);

        return res.status(201).json({
            success: true,
            message: 'Transaction created successfully',
            data: {
                transaction_id: transaction.transaction_id,
                id: transaction._id,
                status: transaction.status,
                amount_paid: transaction.amount_paid,
            },
        });
    } catch (error) {
        console.error('❌ Error creating transaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create transaction',
            error: error.message,
        });
    }
};

/**
 * PUT /api/transaction-history/:transactionId/complete
 * Mark transaction as completed after successful Razorpay payment
 */
export const completeTransaction = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
        } = req.body;

        const organizationId = req.user?.organizationId || req.user?.organization_id;

        if (!razorpay_payment_id) {
            return res.status(400).json({
                success: false,
                message: 'Razorpay payment ID is required',
            });
        }

        // Find transaction
        const transaction = await TransactionHistory.findById(transactionId);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        // Verify ownership
        if (transaction.organization_id.toString() !== organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to update this transaction',
            });
        }

        // Update transaction
        transaction.status = 'COMPLETED';
        transaction.razorpay_payment_id = razorpay_payment_id;
        transaction.razorpay_order_id = razorpay_order_id || null;
        transaction.razorpay_signature = razorpay_signature || null;
        transaction.payment_completed_at = new Date();

        await transaction.save();

        // 🆕 Create or update OrganizationSubscription after successful payment
        let subscription = await OrganizationSubscription.findOne({
            organization_id: transaction.organization_id,
        });

        // Calculate subscription dates based on billing cycle
        const subscriptionStartDate = new Date();
        const daysToAdd = transaction.billing_cycle === 'YEARLY' ? 365 : 30;
        const subscriptionEndDate = new Date(
            subscriptionStartDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000
        );

        if (!subscription) {
            // Create new subscription
            subscription = await OrganizationSubscription.create({
                organization_id: transaction.organization_id,
                license_code: transaction.license_code,
                status: 'ACTIVE',
                billing_cycle: transaction.billing_cycle,
                seats_purchased: transaction.seats_purchased,
                subscription_start_date: subscriptionStartDate,
                subscription_end_date: subscriptionEndDate,
                next_billing_date: subscriptionEndDate,
                auto_renewal: true,
                amount_per_billing_cycle: transaction.final_amount,
            });

            console.log(`✅ OrganizationSubscription created for org: ${transaction.organization_id}`);
        } else {
            // Update existing subscription
            subscription.license_code = transaction.license_code;
            subscription.status = 'ACTIVE';
            subscription.billing_cycle = transaction.billing_cycle;
            subscription.seats_purchased = transaction.seats_purchased;
            subscription.subscription_start_date = subscriptionStartDate;
            subscription.subscription_end_date = subscriptionEndDate;
            subscription.next_billing_date = subscriptionEndDate;
            subscription.amount_per_billing_cycle = transaction.final_amount;

            await subscription.save();

            console.log(`✅ OrganizationSubscription updated for org: ${transaction.organization_id}`);
        }

        console.log(`✅ Transaction completed: ${transaction._id}`);

        return res.status(200).json({
            success: true,
            message: 'Transaction marked as completed',
            data: {
                id: transaction._id,
                status: transaction.status,
                razorpay_payment_id: transaction.razorpay_payment_id,
            },
        });
    } catch (error) {
        console.error('❌ Error completing transaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to complete transaction',
            error: error.message,
        });
    }
};

/**
 * PUT /api/transaction-history/:transactionId/fail
 * Mark transaction as failed if payment fails
 */
export const failTransaction = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { error_message, error_code, razorpay_order_id } = req.body;

        const organizationId = req.user?.organizationId || req.user?.organization_id;

        const transaction = await TransactionHistory.findById(transactionId);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        // Verify ownership
        if (transaction.organization_id.toString() !== organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to update this transaction',
            });
        }

        // Update transaction
        transaction.status = 'FAILED';
        transaction.error_message = error_message || 'Payment failed';
        transaction.error_code = error_code || null;
        transaction.razorpay_order_id = razorpay_order_id || null;

        await transaction.save();

        console.log(`❌ Transaction failed: ${transaction._id}`);

        return res.status(200).json({
            success: true,
            message: 'Transaction marked as failed',
            data: {
                id: transaction._id,
                status: transaction.status,
            },
        });
    } catch (error) {
        console.error('❌ Error failing transaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update transaction',
            error: error.message,
        });
    }
};

/**
 * POST /api/transaction-history/:transactionId/refund
 * Process refund for a transaction
 */
export const refundTransaction = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { refund_id, refund_reason, refund_amount } = req.body;

        const organizationId = req.user?.organizationId || req.user?.organization_id;

        if (!refund_id || !refund_reason) {
            return res.status(400).json({
                success: false,
                message: 'Refund ID and reason are required',
            });
        }

        const transaction = await TransactionHistory.findById(transactionId);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        // Verify ownership
        if (transaction.organization_id.toString() !== organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to refund this transaction',
            });
        }

        if (transaction.status !== 'COMPLETED') {
            return res.status(400).json({
                success: false,
                message: 'Only completed transactions can be refunded',
            });
        }

        // Process refund
        await transaction.processRefund(
            refund_id,
            refund_amount || transaction.amount_paid,
            refund_reason
        );

        console.log(`💰 Transaction refunded: ${transaction._id}`);

        return res.status(200).json({
            success: true,
            message: 'Transaction refunded successfully',
            data: {
                id: transaction._id,
                status: transaction.status,
                refund_id: transaction.refund_id,
                refund_amount: transaction.refund_amount,
            },
        });
    } catch (error) {
        console.error('❌ Error refunding transaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to refund transaction',
            error: error.message,
        });
    }
};

/**
 * GET /api/transaction-history/search
 * Search transactions by various criteria
 */
export const searchTransactions = async (req, res) => {
    try {
        const organizationId = req.user?.organizationId || req.user?.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;
        const { license_code, status, start_date, end_date, transaction_id } = req.query;

        const isIndividual = req.user.role === 'individual' || (Array.isArray(req.user.role) && req.user.role.includes('individual'));

        if (!organizationId && !isIndividual) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID not found',
            });
        }

        const query = organizationId ? { organization_id: organizationId } : { user_id: userId };

        if (license_code) {
            query.license_code = license_code.toUpperCase();
        }

        if (status) {
            query.status = status.toUpperCase();
        }

        if (transaction_id) {
            query.transaction_id = { $regex: transaction_id, $options: 'i' };
        }

        if (start_date || end_date) {
            query.transaction_date = {};
            if (start_date) {
                query.transaction_date.$gte = new Date(start_date);
            }
            if (end_date) {
                query.transaction_date.$lte = new Date(end_date);
            }
        }

        const transactions = await TransactionHistory.find(query)
            .populate('user_id', 'name email')
            .sort({ transaction_date: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: transactions,
            count: transactions.length,
        });
    } catch (error) {
        console.error('❌ Error searching transactions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to search transactions',
            error: error.message,
        });
    }
};

/**
 * GET /api/transaction-history/stats
 * Get transaction statistics for the organization
 */
export const getTransactionStats = async (req, res) => {
    try {
        const organizationId = req.user?.organizationId || req.user?.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;

        const isIndividual = req.user.role === 'individual' || (Array.isArray(req.user.role) && req.user.role.includes('individual'));

        if (!organizationId && !isIndividual) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID not found',
            });
        }

        const queryBase = organizationId ? { organization_id: organizationId } : { user_id: userId };

        // Get various statistics
        const totalTransactions = await TransactionHistory.countDocuments(queryBase);

        const completedTransactions = await TransactionHistory.countDocuments({
            ...queryBase,
            status: 'COMPLETED',
        });

        const aggregationMatch = organizationId
            ? { organization_id: new (require('mongoose')).Types.ObjectId(organizationId), status: 'COMPLETED' }
            : { user_id: new (require('mongoose')).Types.ObjectId(userId), status: 'COMPLETED' };

        const totalRevenue = await TransactionHistory.aggregate([
            {
                $match: aggregationMatch,
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount_paid' },
                },
            },
        ]);

        const byLicenseCode = await TransactionHistory.aggregate([
            {
                $match: aggregationMatch,
            },
            {
                $group: {
                    _id: '$license_code',
                    count: { $sum: 1 },
                    revenue: { $sum: '$amount_paid' },
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            data: {
                totalTransactions,
                completedTransactions,
                totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
                byLicenseCode,
            },
        });
    } catch (error) {
        console.error('❌ Error fetching transaction stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction statistics',
            error: error.message,
        });
    }
};

export default {
    getOrganizationTransactions,
    getTransactionById,
    createTransaction,
    completeTransaction,
    failTransaction,
    refundTransaction,
    searchTransactions,
    getTransactionStats,
};
