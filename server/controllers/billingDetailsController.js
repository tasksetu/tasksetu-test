import { BillingDetails } from '../modals/billingDetailsModal.js';
import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';

/**
 * GET /api/billing-details
 * Get all billing details for organization
 */
export const getBillingDetails = async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.user.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;

        // Individual users might not have an organizationId
        const isIndividual = req.user.role === 'individual' || (Array.isArray(req.user.role) && req.user.role.includes('individual'));

        if (!organizationId && !isIndividual) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID not found'
            });
        }

        const query = { is_active: true };
        if (organizationId) {
            query.organization_id = organizationId;
        } else {
            query.user_id = userId;
        }

        let billingDetails = await BillingDetails.find(query).sort({ is_default: -1, created_at: -1 });

        // 🆕 AUTO-REPAIR: If empty but user has an active license, create a basic profile
        if (billingDetails.length === 0 && userId) {
            const user = await User.findById(userId);

            if (user && (user.license_code && user.license_code !== 'FREE')) {
                console.log(`ℹ️ Auto-creating billing profile for user ${userId} with license ${user.license_code}`);
                const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
                const newDetail = await BillingDetails.create({
                    organization_id: organizationId || null,
                    user_id: userId,
                    payment_method: 'OTHER',
                    card_holder_name: fullName,
                    billing_contact: {
                        company_name: isIndividual ? 'Individual Account' : 'Organization',
                        contact_name: fullName,
                        contact_email: user.email,
                        contact_phone: user.phone || ''
                    },
                    tax_info: {
                        billing_address: 'Not Provided',
                        city: '',
                        state_province: '',
                        postal_code: '',
                        country: 'India'
                    },
                    is_default: true,
                    is_active: true
                });
                billingDetails = [newDetail];
            }
        }

        console.log(`📋 Fetched ${billingDetails.length} billing details for ${organizationId ? 'org: ' + organizationId : 'user: ' + userId}`);

        return res.status(200).json({
            success: true,
            data: billingDetails
        });

    } catch (error) {
        console.error('❌ Error fetching billing details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch billing details',
            error: error.message
        });
    }
};

/**
 * POST /api/billing-details
 * Create new billing details
 */
export const createBillingDetails = async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.user.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;

        const {
            payment_method,
            card_holder_name,
            card_number,
            card_expiry,
            billing_contact,
            tax_info,
            is_default,
            notes
        } = req.body;

        const isIndividual = req.user.role === 'individual' || (Array.isArray(req.user.role) && req.user.role.includes('individual'));

        if (!organizationId && !isIndividual) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID not found'
            });
        }

        // Validate required fields
        if (!payment_method || !card_holder_name || !billing_contact || !tax_info) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: payment_method, card_holder_name, billing_contact, tax_info'
            });
        }

        // If setting as default, unset other defaults
        if (is_default) {
            const unsetQuery = organizationId ? { organization_id: organizationId } : { user_id: userId };
            await BillingDetails.updateMany(
                { ...unsetQuery, is_default: true },
                { is_default: false }
            );
        }

        const newBillingDetails = new BillingDetails({
            organization_id: organizationId || null,
            user_id: userId,
            payment_method,
            card_holder_name,
            card_number: card_number ? card_number.slice(-4) : null, // Store only last 4 digits
            card_expiry,
            billing_contact,
            tax_info,
            is_default: is_default || false,
            notes
        });

        await newBillingDetails.save();

        console.log(`✅ Created billing details: ${newBillingDetails._id}`);

        return res.status(201).json({
            success: true,
            message: 'Billing details created successfully',
            data: newBillingDetails
        });

    } catch (error) {
        console.error('❌ Error creating billing details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create billing details',
            error: error.message
        });
    }
};

/**
 * PUT /api/billing-details/:billingDetailsId
 * Update billing details
 */
export const updateBillingDetails = async (req, res) => {
    try {
        const { billingDetailsId } = req.params;
        const organizationId = req.user.organizationId || req.user.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;

        const isIndividual = req.user.role === 'individual' || (Array.isArray(req.user.role) && req.user.role.includes('individual'));

        if (!organizationId && !isIndividual) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID not found'
            });
        }

        const findQuery = { _id: billingDetailsId };
        if (organizationId) {
            findQuery.organization_id = organizationId;
        } else {
            findQuery.user_id = userId;
        }

        const billingDetails = await BillingDetails.findOne(findQuery);

        if (!billingDetails) {
            return res.status(404).json({
                success: false,
                message: 'Billing details not found'
            });
        }

        const {
            payment_method,
            card_holder_name,
            card_number,
            card_expiry,
            billing_contact,
            tax_info,
            is_default,
            notes
        } = req.body;

        // Update fields
        if (payment_method) billingDetails.payment_method = payment_method;
        if (card_holder_name) billingDetails.card_holder_name = card_holder_name;
        if (card_number) billingDetails.card_number = card_number.slice(-4);
        if (card_expiry) billingDetails.card_expiry = card_expiry;
        if (billing_contact) billingDetails.billing_contact = billing_contact;
        if (tax_info) billingDetails.tax_info = tax_info;
        if (notes !== undefined) billingDetails.notes = notes;

        // If setting as default, unset other defaults
        if (is_default && !billingDetails.is_default) {
            const unsetQuery = organizationId ? { organization_id: organizationId } : { user_id: userId };
            await BillingDetails.updateMany(
                { ...unsetQuery, is_default: true },
                { is_default: false }
            );
            billingDetails.is_default = true;
        }

        billingDetails.updated_at = new Date();
        await billingDetails.save();

        console.log(`✅ Updated billing details: ${billingDetailsId}`);

        return res.status(200).json({
            success: true,
            message: 'Billing details updated successfully',
            data: billingDetails
        });

    } catch (error) {
        console.error('❌ Error updating billing details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update billing details',
            error: error.message
        });
    }
};

/**
 * DELETE /api/billing-details/:billingDetailsId
 * Delete billing details (soft delete - mark as inactive)
 */
export const deleteBillingDetails = async (req, res) => {
    try {
        const { billingDetailsId } = req.params;
        const organizationId = req.user.organizationId || req.user.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;

        const isIndividual = req.user.role === 'individual' || (Array.isArray(req.user.role) && req.user.role.includes('individual'));

        if (!organizationId && !isIndividual) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID not found'
            });
        }

        const findQuery = { _id: billingDetailsId };
        if (organizationId) {
            findQuery.organization_id = organizationId;
        } else {
            findQuery.user_id = userId;
        }

        const billingDetails = await BillingDetails.findOne(findQuery);

        if (!billingDetails) {
            return res.status(404).json({
                success: false,
                message: 'Billing details not found'
            });
        }

        // Soft delete
        billingDetails.is_active = false;
        await billingDetails.save();

        console.log(`✅ Deleted billing details: ${billingDetailsId}`);

        return res.status(200).json({
            success: true,
            message: 'Billing details deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting billing details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete billing details',
            error: error.message
        });
    }
};

/**
 * GET /api/billing-details/:billingDetailsId
 * Get single billing details
 */
export const getBillingDetailsById = async (req, res) => {
    try {
        const { billingDetailsId } = req.params;
        const organizationId = req.user.organizationId || req.user.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;

        const findQuery = { _id: billingDetailsId, is_active: true };
        if (organizationId) {
            findQuery.organization_id = organizationId;
        } else {
            findQuery.user_id = userId;
        }

        const billingDetails = await BillingDetails.findOne(findQuery);

        if (!billingDetails) {
            return res.status(404).json({
                success: false,
                message: 'Billing details not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: billingDetails
        });

    } catch (error) {
        console.error('❌ Error fetching billing details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch billing details',
            error: error.message
        });
    }
};

/**
 * POST /api/billing-details/:billingDetailsId/set-default
 * Set billing details as default
 */
export const setDefaultBillingDetails = async (req, res) => {
    try {
        const { billingDetailsId } = req.params;
        const organizationId = req.user.organizationId || req.user.organization_id;
        const userId = req.user?._id || req.user?.userId || req.user?.id;

        // Unset all defaults for this organization/user
        const unsetQuery = organizationId ? { organization_id: organizationId } : { user_id: userId };
        await BillingDetails.updateMany(
            { ...unsetQuery, is_default: true },
            { is_default: false }
        );

        // Set this as default
        const billingDetails = await BillingDetails.findByIdAndUpdate(
            billingDetailsId,
            { is_default: true, updated_at: new Date() },
            { new: true }
        );

        if (!billingDetails) {
            return res.status(404).json({
                success: false,
                message: 'Billing details not found'
            });
        }

        console.log(`✅ Set as default: ${billingDetailsId}`);

        return res.status(200).json({
            success: true,
            message: 'Set as default successfully',
            data: billingDetails
        });

    } catch (error) {
        console.error('❌ Error setting default billing details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to set default',
            error: error.message
        });
    }
};

export default {
    getBillingDetails,
    createBillingDetails,
    updateBillingDetails,
    deleteBillingDetails,
    getBillingDetailsById,
    setDefaultBillingDetails
};
