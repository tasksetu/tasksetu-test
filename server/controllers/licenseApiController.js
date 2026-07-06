/**
 * 🎯 LICENSE API CONTROLLER
 * Handles ALL license-related API endpoints for different user roles
 * 
 * Endpoints:
 * - Common: GET /license/current, /license/features, /license/usage/summary
 * - Org Admin: POST /license/upgrade, GET /billing/invoices
 * - Super Admin: Handled in superAdminOrganizationController.js
 */

import { User } from '../modals/userModal.js';
import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { License } from '../modals/licenseModal.js';
import { LicenseFeatureMapping } from '../modals/licenseFeatureMappingModal.js';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import { Feature } from '../modals/featureModal.js';
import * as licenseService from '../services/licenseService.js';

// ============================================================================
// 🔹 A. COMMON LICENSE APIs (All Logged-in Users)
// ============================================================================

/**
 * 1️⃣ Get Current User's License
 * GET /api/license/current
 * 
 * Returns the license assigned to the current logged-in user
 * Used by: User profile, feature guards, navigation
 * 
 * Response:
 * {
 *   "user_id": "usr_501",
 *   "license": {
 *     "type": "EXECUTE",
 *     "assigned_at": "2025-02-01T10:21:00Z"
 *   }
 * }
 */
export const getCurrentLicense = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const user = await User.findById(userId).select('license_id firstName lastName email');

        if (!user) {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Get license details if assigned
        let licenseDetails = null;
        if (user.license_id) {
            const { CompanyLicense } = await import('../modals/companyLicenseModal.js');
            licenseDetails = await CompanyLicense.findById(user.license_id);
        }

        if (!licenseDetails) {
            return res.status(200).json({
                user_id: userId.toString(),
                license: null
            });
        }

        res.status(200).json({
            user_id: userId.toString(),
            license: {
                type: licenseDetails.license_type,
                assigned_at: licenseDetails.assigned_at || licenseDetails.purchased_at
            }
        });

    } catch (error) {
        console.error('❌ Error fetching current license:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Error fetching license information',
            details: error.message
        });
    }
};

/**
 * 2️⃣ Feature Access Map
 * GET /api/license/features
 * 
 * Returns feature → boolean map for frontend to show locks/disable buttons
 */
export const getFeatureAccessMap = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const user = await User.findById(userId).select('organizationId');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const entity = {
            type: user.organizationId ? 'COMPANY' : 'USER',
            id: user.organizationId || userId
        };

        // Get subscription
        const subscription = await licenseService.getActiveSubscription(entity);
        if (!subscription) {
            return res.status(200).json({
                // Return empty map - user has no features
            });
        }

        // Get all features for this license
        const featureMappings = await LicenseFeatureMapping.find({
            license_code: subscription.license_code
        }).populate('feature_id').lean();

        const accessMap = {};

        // Check each feature
        for (const mapping of featureMappings) {
            const featureCode = mapping.feature_id?.feature_code;
            if (!featureCode) continue;

            // Check access
            const accessCheck = await licenseService.checkFeatureAccess(entity, featureCode);

            if (accessCheck.hasAccess) {
                // Check limit
                const limitCheck = await licenseService.checkFeatureLimit(entity, featureCode);

                accessMap[featureCode] = {
                    enabled: limitCheck.canConsume,
                    limit: mapping.limit,
                    used: limitCheck.usage?.current_usage || 0,
                    reason: !limitCheck.canConsume ? 'LIMIT_REACHED' : null
                };
            } else {
                accessMap[featureCode] = {
                    enabled: false,
                    reason: 'UPGRADE_REQUIRED'
                };
            }
        }

        console.log(`✅ [LICENSE API] Feature access map for ${entity.type} ${entity.id}`);

        res.status(200).json(accessMap);
    } catch (error) {
        console.error('❌ Error fetching feature access map:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching feature access',
            error: error.message
        });
    }
};

/**
 * 3️⃣ License Usage Summary (Lightweight - for header widgets)
 * GET /api/license/usage/summary
 */
export const getUsageSummary = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const user = await User.findById(userId).select('organizationId');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const entity = {
            type: user.organizationId ? 'COMPANY' : 'USER',
            id: user.organizationId || userId
        };

        // Get summary
        const summary = await licenseService.getLicenseSummary(entity);

        if (!summary.success) {
            return res.status(200).json({});
        }

        // Transform to "used/limit" format
        const usageSummary = {};
        summary.usage.forEach(u => {
            usageSummary[u.feature_code] = `${u.current_usage}/${u.limit}`;
        });

        res.status(200).json(usageSummary);
    } catch (error) {
        console.error('❌ Error fetching usage summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching usage',
            error: error.message
        });
    }
};

// ============================================================================
// 🔹 B. ORG ADMIN / INDIVIDUAL ADMIN APIs
// ============================================================================

/**
 * 4️⃣ Upgrade / Change Plan
 * POST /api/license/upgrade
 * 
 * Allows org admin to upgrade/downgrade license
 */
export const upgradeLicense = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { targetLicense, billingCycle = 'MONTHLY', couponCode } = req.body;

        if (!targetLicense) {
            return res.status(400).json({
                success: false,
                message: 'Target license code is required'
            });
        }

        const user = await User.findById(userId).select('organizationId role');

        // Only org admin can upgrade
        if (user.organizationId && user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only organization admin can upgrade license'
            });
        }

        const entity = {
            type: user.organizationId ? 'COMPANY' : 'USER',
            id: user.organizationId || userId
        };

        // Check if target license exists
        const targetLicenseDoc = await License.findOne({
            license_code: targetLicense.toUpperCase()
        });

        if (!targetLicenseDoc) {
            return res.status(404).json({
                success: false,
                message: 'Target license plan not found'
            });
        }

        // Get current subscription
        const currentSub = await licenseService.getActiveSubscription(entity);

        if (!currentSub) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }

        // Check for downgrade conflicts (usage exceeds new plan limits)
        const currentLicense = await License.findOne({
            license_code: currentSub.license_code
        });

        const currentFeatures = await LicenseFeatureMapping.find({
            license_code: currentLicense.license_code
        }).populate('feature_id');

        const targetFeatures = await LicenseFeatureMapping.find({
            license_code: targetLicense.toUpperCase()
        }).populate('feature_id');

        // Check for conflicts
        const conflicts = {};

        for (const currentFeature of currentFeatures) {
            const featureCode = currentFeature.feature_id?.feature_code;
            if (!featureCode) continue;

            // Get current usage
            const usage = await FeatureUsageTracking.findOne({
                [entity.type === 'USER' ? 'user_id' : 'organization_id']: entity.id,
                feature_code: featureCode
            });

            if (!usage) continue;

            // Find corresponding feature in target license
            const targetFeature = targetFeatures.find(
                tf => tf.feature_id?.feature_code === featureCode
            );

            if (!targetFeature) {
                // Feature not available in target plan
                if (usage.current_usage > 0) {
                    conflicts[featureCode] = {
                        used: usage.current_usage,
                        allowed: 0,
                        reason: 'FEATURE_NOT_AVAILABLE'
                    };
                }
            } else if (usage.current_usage > targetFeature.limit) {
                // Usage exceeds target limit
                conflicts[featureCode] = {
                    used: usage.current_usage,
                    allowed: targetFeature.limit
                };
            }
        }

        // If there are conflicts, block downgrade
        if (Object.keys(conflicts).length > 0) {
            return res.status(400).json({
                errorCode: 'DOWNGRADE_BLOCKED',
                message: 'Current usage exceeds target plan limits',
                details: conflicts
            });
        }

        // Proceed with upgrade
        console.log(`\n🔄 ========== LICENSE UPGRADE START ==========`);
        console.log(`📋 Entity Type: ${entity.type}`);
        console.log(`👤 Entity ID: ${entity.id}`);
        console.log(`📦 Target License: ${targetLicense}`);
        console.log(`<RecurringTaskIcon size={size} className="flex-shrink-0" /> Billing Cycle: ${billingCycle}`);

        // ✅ SINGLE SOURCE OF TRUTH: Fetch license definition for duration
        const { License } = await import('../modals/licenseModal.js');
        const licenseDef = await License.findOne({ license_code: targetLicense.toUpperCase() });

        const now = new Date();
        const endDate = new Date(now);
        
        let daysToAdd = 30; // Default fallback for MONTHLY
        
        if (licenseDef) {
            if (billingCycle === 'YEARLY') {
                daysToAdd = 365;
            } else if (licenseDef.billing_cycle === 'TRIAL') {
                daysToAdd = licenseDef.trial_days;
            } else {
                daysToAdd = 30; // Standard monthly
            }
        }

        endDate.setDate(endDate.getDate() + daysToAdd);

        console.log(`⏰ Current Date: ${now.toISOString()}`);
        console.log(`📅 Calculated Expiry Date: ${endDate.toISOString()}`);
        console.log(`📊 Days Added: ${daysToAdd} (from ${licenseDef ? 'license def' : 'default'})`);

        currentSub.license_code = targetLicense.toUpperCase();
        currentSub.billing_cycle = billingCycle;
        currentSub.subscription_start_date = now;
        currentSub.subscription_end_date = endDate;
        currentSub.trial_end_date = null; // Clear trial on upgrade

        // Apply coupon if provided (this would integrate with billing system)
        if (couponCode) {
            currentSub.coupon_code = couponCode;
            console.log(`🎟️ Coupon Applied: ${couponCode}`);
            // TODO: Validate and apply coupon discount
        }

        console.log(`💾 Saving OrganizationSubscription...`);
        await currentSub.save();
        console.log(`✅ OrganizationSubscription saved successfully`);

        // 🔥 FIX: Update User.license_expiry for individual users
        if (entity.type === 'USER') {
            console.log(`\n👤 ========== UPDATING USER DOCUMENT ==========`);
            console.log(`🔍 User ID: ${entity.id}`);
            console.log(`📅 Setting license_expiry to: ${endDate.toISOString()}`);
            console.log(`📅 Setting subscription_end_date to: ${endDate.toISOString()}`);

            await User.findByIdAndUpdate(entity.id, {
                license_expiry: endDate,
                subscription_end_date: endDate
            });

            console.log(`✅ [USER LICENSE EXPIRY UPDATED] User ${entity.id}`);
            console.log(`   - license_expiry: ${endDate.toISOString()}`);
            console.log(`   - subscription_end_date: ${endDate.toISOString()}`);
            console.log(`   - Days from now: ${daysToAdd}`);
        }

        console.log(`\n✅ ========== LICENSE UPGRADE COMPLETE ==========`);
        console.log(`📦 ${entity.type} ${entity.id} → ${targetLicense}`);
        console.log(`📅 Expires: ${endDate.toISOString()}`);
        console.log(`=================================================\n`);

        res.status(200).json({
            status: 'SUCCESS',
            message: 'License upgraded successfully',
            license: {
                code: targetLicense.toUpperCase(),
                billingCycle,
                endDate
            }
        });
    } catch (error) {
        console.error('❌ Error upgrading license:', error);
        res.status(500).json({
            success: false,
            message: 'Error upgrading license',
            error: error.message
        });
    }
};

/**
 * 5️⃣ Billing History
 * GET /api/billing/invoices
 * 
 * Returns billing history for current organization
 */
export const getBillingInvoices = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const user = await User.findById(userId).select('organizationId role');

        // Only org members can see billing
        if (!user.organizationId) {
            return res.status(200).json([]);
        }

        // In real implementation, this would fetch from payment gateway
        // For now, return mock data structure
        const licenses = await License.find({ is_active: true });
        const priceMap = {};
        licenses.forEach(l => {
            priceMap[l.license_code] = {
                MONTHLY: l.price_monthly,
                YEARLY: l.price_yearly
            };
        });

        const invoices = subscriptions.map((sub, index) => ({
            invoiceId: `INV-${new Date(sub.subscription_start_date).getFullYear()}-${String(index + 1).padStart(4, '0')}`,
            date: sub.subscription_start_date,
            plan: sub.license_code,
            cycle: sub.billing_cycle || 'Monthly',
            amount: priceMap[sub.license_code]?.[sub.billing_cycle?.toUpperCase()] || 0,
            currency: 'INR',
            downloadUrl: `/api/billing/invoices/INV-${new Date(sub.subscription_start_date).getFullYear()}-${String(index + 1).padStart(4, '0')}/download`
        }));

        res.status(200).json(invoices);
    } catch (error) {
        console.error('❌ Error fetching billing invoices:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching invoices',
            error: error.message
        });
    }
};

/**
 * 5️⃣ Update Billing Details
 * PUT /api/billing/update
 * 
 * Updates payment method, billing contact, and tax information
 */
export const updateBillingDetails = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { payment_method, billing_contact, tax_info } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const user = await User.findById(userId).select('organizationId organization_id role');
        const orgId = user?.organizationId || user?.organization_id;

        // For individual users, store billing info on user document
        // For org users, store on organization subscription
        if (orgId) {
            // Update organization subscription with billing details
            const subscription = await OrganizationSubscription.findOneAndUpdate(
                { organization_id: orgId, status: 'ACTIVE' },
                {
                    $set: {
                        'billing_details.payment_method': {
                            last4: payment_method?.card_number?.slice(-4) || null,
                            expiry: payment_method?.expiry || null,
                            cardholder_name: payment_method?.cardholder_name || null,
                            updated_at: new Date()
                        },
                        'billing_details.billing_contact': {
                            company_name: billing_contact?.company_name || null,
                            contact_name: billing_contact?.contact_name || null,
                            contact_email: billing_contact?.contact_email || null,
                            updated_at: new Date()
                        },
                        'billing_details.tax_info': {
                            gst_number: tax_info?.gst_number || null,
                            billing_address: tax_info?.billing_address || null,
                            country: tax_info?.country || null,
                            updated_at: new Date()
                        }
                    }
                },
                { new: true }
            );

            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    message: 'No active subscription found'
                });
            }

            console.log(`✅ [BILLING] Updated billing details for org: ${orgId}`);

            res.status(200).json({
                success: true,
                message: 'Billing details updated successfully',
                billing_details: subscription.billing_details
            });
        } else {
            // Individual user - store in user profile
            await User.findByIdAndUpdate(userId, {
                $set: {
                    'billing_details.payment_method': {
                        last4: payment_method?.card_number?.slice(-4) || null,
                        expiry: payment_method?.expiry || null,
                        cardholder_name: payment_method?.cardholder_name || null,
                        updated_at: new Date()
                    },
                    'billing_details.billing_contact': {
                        company_name: billing_contact?.company_name || null,
                        contact_name: billing_contact?.contact_name || null,
                        contact_email: billing_contact?.contact_email || null,
                        updated_at: new Date()
                    },
                    'billing_details.tax_info': {
                        gst_number: tax_info?.gst_number || null,
                        billing_address: tax_info?.billing_address || null,
                        country: tax_info?.country || null,
                        updated_at: new Date()
                    }
                }
            });

            console.log(`✅ [BILLING] Updated billing details for user: ${userId}`);

            res.status(200).json({
                success: true,
                message: 'Billing details updated successfully'
            });
        }
    } catch (error) {
        console.error('❌ Error updating billing details:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating billing details',
            error: error.message
        });
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    getCurrentLicense,
    getFeatureAccessMap,
    getUsageSummary,
    upgradeLicense,
    getBillingInvoices,
    updateBillingDetails
};
