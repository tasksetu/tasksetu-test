import mongoose from 'mongoose';

/**
 * Billing Details Schema
 * Stores multiple billing profiles for organizations
 * Users can add/edit/delete different billing details (payment methods, contacts, tax info)
 */
const billingDetailsSchema = new mongoose.Schema(
    {
        organization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: false,
            index: true,
        },

        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // Payment Method Details
        payment_method: {
            type: String,
            enum: ['CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'BANK_TRANSFER', 'OTHER'],
            required: true,
        },

        card_holder_name: {
            type: String,
            required: true,
        },

        card_number: {
            type: String,
            default: null,
            // Stored partially for security (last 4 digits only)
        },

        card_expiry: {
            type: String,
            default: null,
            // Format: MM/YY
        },

        // Billing Contact Information
        billing_contact: {
            company_name: {
                type: String,
                required: true,
            },
            contact_name: {
                type: String,
                required: true,
            },
            contact_email: {
                type: String,
                required: true,
            },
            contact_phone: {
                type: String,
                default: null,
            },
        },

        // Tax Information
        tax_info: {
            gst_number: {
                type: String,
                default: null,
            },
            gst_registered: {
                type: Boolean,
                default: false,
            },
            billing_address: {
                type: String,
                required: true,
            },
            city: {
                type: String,
                default: null,
            },
            state_province: {
                type: String,
                default: null,
            },
            postal_code: {
                type: String,
                default: null,
            },
            country: {
                type: String,
                required: true,
            },
        },

        // Status
        is_default: {
            type: Boolean,
            default: false,
            // Mark as default billing details
        },

        is_active: {
            type: Boolean,
            default: true,
        },

        // Notes
        notes: {
            type: String,
            default: null,
        },

        // Metadata
        last_used_date: {
            type: Date,
            default: null,
        },

        created_at: {
            type: Date,
            default: Date.now,
        },

        updated_at: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'billing_details'
    }
);

// Index for faster queries
billingDetailsSchema.index({ organization_id: 1, is_active: 1 });
billingDetailsSchema.index({ organization_id: 1, is_default: 1 });
billingDetailsSchema.index({ user_id: 1, created_at: -1 });

export const BillingDetails = mongoose.model('BillingDetails', billingDetailsSchema);
