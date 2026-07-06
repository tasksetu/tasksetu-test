import mongoose from 'mongoose';

/**
 * Transaction History Schema
 * Stores all payment transactions for organizations
 * When users purchase licenses, a transaction record is created
 * This is used to display payment history in the Billing page
 */
const transactionHistorySchema = new mongoose.Schema(
    {
        // Transaction identification
        transaction_id: {
            type: String,
            required: true,
            unique: true,
            index: true,
            // Format: TXN_TIMESTAMP_RANDOM
        },

        invoice_number: {
            type: String,
            required: false,
            index: true,
        },

        // Billing entity
        organization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: false, // Optional for Individual users
            index: true,
        },

        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
            // The user who made the purchase (organization admin)
        },

        // License/Plan details (LEGACY - kept for backward compatibility)
        license_code: {
            type: String,
            required: false,
            uppercase: true,
            enum: ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'],
            index: true,
        },

        license_name: {
            type: String,
            required: false,
            // e.g., "Execute Plan", "Optimize Plan"
        },

        // ✅ NEW: Support multiple items/licenses in one transaction
        items: [{
            license_code: {
                type: String,
                required: true,
                uppercase: true,
                enum: ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'],
            },
            license_name: String,
            seats_purchased: {
                type: Number,
                required: true,
                min: 1,
            },
            billing_cycle: {
                type: String,
                enum: ['MONTHLY', 'YEARLY'],
                default: 'MONTHLY',
            },
            price_per_seat: {
                type: Number,
                required: true,
                min: 0,
            },
            total_price: {
                type: Number,
                required: true,
                min: 0,
            },
        }],

        // Purchase details (LEGACY - for single item transactions)
        seats_purchased: {
            type: Number,
            required: false,
            min: 1,
        },

        billing_cycle: {
            type: String,
            required: false,
            enum: ['MONTHLY', 'YEARLY'],
            default: 'MONTHLY',
        },

        // Pricing information (LEGACY - for single item transactions)
        price_per_seat: {
            type: Number,
            required: false,
            min: 0,
        },

        total_price: {
            type: Number,
            required: false,
            min: 0,
        },

        discount_applied: {
            type: Boolean,
            default: false,
        },

        discount_code: {
            type: String,
            default: null,
        },

        discount_amount: {
            type: Number,
            default: 0,
            min: 0,
        },

        final_amount: {
            type: Number,
            required: true,
            min: 0,
            // total_price - discount_amount
        },

        tax_amount: {
            type: Number,
            default: 0,
            min: 0,
        },

        tax_percentage: {
            type: Number,
            default: 18,
            min: 0,
            max: 100,
        },

        amount_paid: {
            type: Number,
            required: true,
            // final_amount + tax_amount
        },

        // Payment gateway details
        payment_method: {
            type: String,
            required: true,
            enum: ['RAZORPAY', 'STRIPE', 'PAYPAL', 'UPI', 'BANK_TRANSFER', 'MANUAL'],
            default: 'RAZORPAY',
        },

        razorpay_payment_id: {
            type: String,
            default: null,
            // Razorpay payment ID from the payment response
        },

        razorpay_order_id: {
            type: String,
            default: null,
            index: true,
            // Razorpay order ID for tracking and grouping multiple items
        },

        razorpay_signature: {
            type: String,
            default: null,
            // Razorpay signature for verification
        },

        // ✅ Group ID to link related transactions (for multi-license purchases)
        order_group_id: {
            type: String,
            default: null,
            index: true,
            // When user purchases multiple licenses in one order, they share this group_id
        },

        // Transaction status
        status: {
            type: String,
            required: true,
            enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'],
            default: 'PENDING',
            index: true,
        },

        // Dates
        transaction_date: {
            type: Date,
            default: Date.now,
            index: true,
        },

        payment_completed_at: {
            type: Date,
            default: null,
        },

        renewal_date: {
            type: Date,
            required: true,
            // When the next billing cycle will occur
        },

        // Reference to purchase record
        purchase_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrganizationLicensePurchase',
            default: null,
        },

        // Reference to saved billing details used for this transaction
        billing_detail_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BillingDetails',
            default: null,
            // Stores which saved billing detail was used for this payment
        },

        // Additional metadata
        payment_notes: {
            type: String,
            default: null,
        },

        coupon_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Coupon',
            default: null,
        },

        // Error details if transaction failed
        error_message: {
            type: String,
            default: null,
        },

        error_code: {
            type: String,
            default: null,
        },

        // Refund information
        refund_id: {
            type: String,
            default: null,
        },

        refund_amount: {
            type: Number,
            default: 0,
            min: 0,
        },

        refund_reason: {
            type: String,
            default: null,
        },

        refund_date: {
            type: Date,
            default: null,
        },

        // Currency
        currency: {
            type: String,
            default: 'INR',
            uppercase: true,
        },

        // IP address and device info for fraud detection
        ip_address: {
            type: String,
            default: null,
        },

        user_agent: {
            type: String,
            default: null,
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
            // Store any additional custom data
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'transaction_history'
    }
);

// Indexes for efficient queries
transactionHistorySchema.index({ organization_id: 1, transaction_date: -1 });
transactionHistorySchema.index({ organization_id: 1, status: 1 });
transactionHistorySchema.index({ user_id: 1, transaction_date: -1 });
transactionHistorySchema.index({ razorpay_payment_id: 1 }, { sparse: true });
transactionHistorySchema.index({ transaction_date: -1 });

// Virtual for display status
transactionHistorySchema.virtual('status_display').get(function () {
    const statusMap = {
        'PENDING': 'Pending',
        'COMPLETED': 'Completed',
        'FAILED': 'Failed',
        'CANCELLED': 'Cancelled',
        'REFUNDED': 'Refunded'
    };
    return statusMap[this.status] || this.status;
});

// Method to mark transaction as completed
transactionHistorySchema.methods.markAsCompleted = function (razorpayPaymentId) {
    this.status = 'COMPLETED';
    this.razorpay_payment_id = razorpayPaymentId;
    this.payment_completed_at = new Date();
    return this.save();
};

// Method to mark transaction as failed
transactionHistorySchema.methods.markAsFailed = function (errorMessage, errorCode) {
    this.status = 'FAILED';
    this.error_message = errorMessage;
    this.error_code = errorCode;
    return this.save();
};

// Method to process refund
transactionHistorySchema.methods.processRefund = function (refundId, amount, reason) {
    this.status = 'REFUNDED';
    this.refund_id = refundId;
    this.refund_amount = amount;
    this.refund_reason = reason;
    this.refund_date = new Date();
    return this.save();
};

export const TransactionHistory = mongoose.model('TransactionHistory', transactionHistorySchema);
