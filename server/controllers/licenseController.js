import { License } from '../modals/licenseModal.js';
import { Feature } from '../modals/featureModal.js';
import { LicenseFeatureMapping } from '../modals/licenseFeatureMappingModal.js';
import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';
import { Invoice } from '../modals/invoiceModal.js';
import { TransactionHistory } from '../modals/transactionHistoryModal.js';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import { Coupon } from '../modals/couponModal.js';
import { getFeatureAccessSummary, getEffectiveLicense } from '../middleware/licenseMiddleware.js';
import * as licenseService from '../services/licenseService.js';

/**
 * 🆕 GET /api/license/current
 * Get current license and usage summary for the authenticated user
 * 
 * ✅ UPDATED v2: User-level licensing - returns user's OWN license (no company inheritance)
 * 
 * Response Format:
 * {
 *   "license": "PLAN",
 *   "status": "ACTIVE",
 *   "expiry": "2025-09-12",
 *   "usage": {
 *     "TASK_BASIC": { "used": 60, "limit": 100, "remaining": 40 },
 *     "FORM_CREATE": { "used": 7, "limit": 10, "remaining": 3 }
 *   },
 *   "user": { ... }
 * }
 */
export const getCurrentLicense = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'USER_REQUIRED',
      });
    }

    // ✅ NEW: Always use user-level license summary
    const summary = await licenseService.getLicenseSummary(userId);

    res.status(200).json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('❌ Error fetching current license:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching license information',
      error: error.message,
    });
  }
};

/**
 * 🆕 GET /api/license/features
 * Get feature access map (feature_code → allowed/blocked)
 * Used by frontend to show/hide features, lock icons, disable buttons
 * 
 * Response Format:
 * {
 *   "TASK_APPROVAL": false,
 *   "TASK_BASIC": true,
 *   "FORM_CREATE": true,
 *   "FORM_ADVANCED": false
 * }
 */
export const getFeatureAccessMap = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'USER_REQUIRED',
      });
    }

    // ✅ FIXED: Always use USER entity type for feature access checks
    // License is assigned at user level (even for company users)
    // Company entity is only for pool management, not feature access
    const entity = {
      entity_type: 'USER',
      entity_id: userId,
    };

    // Get all features
    const allFeatures = await Feature.find({ is_active: true }).select('feature_code').lean();

    // Check access for each feature
    const featureAccessMap = {};

    for (const feature of allFeatures) {
      const accessCheck = await licenseService.checkFeatureAccess(entity, feature.feature_code);
      featureAccessMap[feature.feature_code] = accessCheck.hasAccess;
    }

    res.status(200).json({
      success: true,
      features: featureAccessMap,
      entity_type: entity.entity_type,
    });
  } catch (error) {
    console.error('❌ Error fetching feature access map:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching feature access',
      error: error.message,
    });
  }
};

/**
 * Get all available licenses
 */
export const getAllLicenses = async (req, res) => {
  try {
    const licenses = await License.find({ is_active: true })
      .sort({ display_order: 1 })
      .lean();

    // Get feature count for each license
    const licensesWithFeatures = await Promise.all(
      licenses.map(async (license) => {
        const features = await LicenseFeatureMapping.countDocuments({
          license_code: license.license_code,
          is_enabled: true,
        });

        return {
          ...license,
          feature_count: features,
          yearly_discount: license.price_monthly > 0
            ? Math.round(
              ((license.price_monthly * 12 - license.price_yearly) /
                (license.price_monthly * 12)) *
              100
            )
            : 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      licenses: licensesWithFeatures,
    });
  } catch (error) {
    console.error('❌ Error fetching licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching licenses',
      error: error.message,
    });
  }
};

/**
 * Get license details by code
 */
export const getLicenseByCode = async (req, res) => {
  try {
    const { licenseCode } = req.params;

    const license = await License.findOne({
      license_code: licenseCode.toUpperCase(),
      is_active: true,
    }).lean();

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'License not found',
      });
    }

    // Get features for this license
    const features = await LicenseFeatureMapping.getFeaturesByLicense(
      license.license_code
    );

    // Populate feature details
    const featureDetails = await Feature.find({
      feature_code: { $in: features.map((f) => f.feature_code) },
      is_active: true,
    }).lean();

    const featureMap = {};
    featureDetails.forEach((f) => {
      featureMap[f.feature_code] = f;
    });

    const enrichedFeatures = features.map((f) => ({
      ...f,
      ...featureMap[f.feature_code],
    }));

    res.status(200).json({
      success: true,
      license,
      features: enrichedFeatures,
    });
  } catch (error) {
    console.error('❌ Error fetching license:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching license details',
      error: error.message,
    });
  }
};

/**
 * Get all features grouped by category
 */
export const getAllFeatures = async (req, res) => {
  try {
    const features = await Feature.find({ is_active: true, view: { $ne: false } })
      .sort({ category: 1, display_order: 1 })
      .lean();

    const featuresByCategory = {};
    features.forEach((feature) => {
      if (!featuresByCategory[feature.category]) {
        featuresByCategory[feature.category] = [];
      }
      featuresByCategory[feature.category].push(feature);
    });

    const mappings = await LicenseFeatureMapping.find({ is_enabled: true }).lean();

    res.status(200).json({
      success: true,
      features: featuresByCategory,
      mappings: mappings,
    });
  } catch (error) {
    console.error('❌ Error fetching features:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching features',
      error: error.message,
    });
  }
};

/**
 * Get current subscription (individual or company)
 * Individual account: Returns user.license_code
 * Company account: Returns organization.license_code
 */
export const getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_REQUIRED',
      });
    }

    // Get effective license
    const licenseInfo = await getEffectiveLicense(userId, organizationId);

    // Get license details
    const license = await License.findOne({
      license_code: licenseInfo.license_code,
    }).lean();

    // Get additional details based on account type
    let additionalInfo = {};

    if (licenseInfo.account_type === 'individual') {
      const user = await User.findById(userId).lean();

      // Calculate grace period info
      let gracePeriodInfo = null;
      if (licenseInfo.expiry_date) {
        const graceDays = license && license.grace_period_days !== undefined ? license.grace_period_days : 5;
        const expiryDate = new Date(licenseInfo.expiry_date);
        const now = new Date();
        const gracePeriodEnd = new Date(expiryDate);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);
        const isExpired = expiryDate <= now;
        const isInGracePeriod = isExpired && now <= gracePeriodEnd;

        gracePeriodInfo = {
          grace_period_days: graceDays,
          grace_period_end: gracePeriodEnd,
          is_expired: isExpired,
          is_in_grace_period: isInGracePeriod,
          days_remaining_in_grace: isInGracePeriod
            ? Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : 0,
        };
      }

      // Get pending license info
      const pendingLicense = user?.pending_license?.license_code ? user.pending_license : null;

      additionalInfo = {
        user_name: `${user.firstName} ${user.lastName}`,
        user_email: user.email,
        expiry_date: licenseInfo.expiry_date,
        billing_cycle: licenseInfo.billing_cycle || 'MONTHLY',
        status: licenseInfo.status || 'ACTIVE',
        // Include billing details for individual users
        payment_method: user?.billing_details?.payment_method || null,
        billing_contact: user?.billing_details?.billing_contact || null,
        tax_info: user?.billing_details?.tax_info || null,
        // 🆕 Grace period and pending license info
        grace_period_info: gracePeriodInfo,
        pending_license: pendingLicense,
      };
    } else if (licenseInfo.account_type === 'company') {
      const organization = await Organization.findById(organizationId).lean();
      let subscription = await OrganizationSubscription.findOne({
        organization_id: organizationId,
      }).lean();

      // Auto-create/fix trial subscription if it doesn't exist for a user on EXPLORE plan
      if (!subscription && licenseInfo.license_code === 'EXPLORE') {
        const { OrganizationSubscription: OrgSubModel } = await import('../modals/organizationSubscriptionModal.js');
        try {
          const exploreLicense = await License.findOne({ license_code: 'EXPLORE' }).lean();

          const newSubscription = await OrgSubModel.create({
            organization_id: organizationId,
            license_code: 'EXPLORE',
            status: 'ACTIVE',
            trial_start_date: null,
            trial_end_date: null,
            subscription_start_date: new Date(),
            subscription_end_date: null,
            seats_purchased: exploreLicense?.max_users || 10,
            seats_used: 1,
          });
          console.log(`ℹ️ Auto-created missing trial subscription for organization ${organizationId}`);
          subscription = newSubscription.toObject();
        } catch (createErr) {
          console.error(`⚠️ Failed to auto-create missing subscription:`, createErr.message);
        }
      }

      // 🆕 Calculate grace period info for the individual user's license instance
      // (The user's license comes from their license_instance_id, not the org subscription)
      let gracePeriodInfo = null;
      if (licenseInfo.expiry_date) {
        const graceDays = license && license.grace_period_days !== undefined ? license.grace_period_days : 5;
        const expiryDate = new Date(licenseInfo.expiry_date);
        const now = new Date();
        const gracePeriodEnd = new Date(expiryDate);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);
        const isExpired = expiryDate <= now;
        const isInGracePeriod = isExpired && now <= gracePeriodEnd;

        gracePeriodInfo = {
          grace_period_days: graceDays,
          grace_period_end: gracePeriodEnd,
          is_expired: isExpired,
          is_in_grace_period: isInGracePeriod,
          days_remaining_in_grace: isInGracePeriod
            ? Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : 0,
        };
      }

      additionalInfo = {
        organization_name: organization?.name,
        seats_used: subscription?.seats_used || 0,
        seats_purchased: subscription?.seats_purchased || 0,
        days_remaining: subscription ? (
          subscription.trial_end_date || subscription.subscription_end_date
            ? Math.ceil(
              (new Date(subscription.trial_end_date || subscription.subscription_end_date) - new Date()) /
              (1000 * 60 * 60 * 24)
            )
            : null
        ) : null,
        status: subscription?.status || 'active',
        expiry_date: licenseInfo.expiry_date,
        billing_cycle: licenseInfo.billing_cycle || 'MONTHLY',
        // Include billing details for display
        payment_method: subscription?.billing_details?.payment_method || null,
        billing_contact: subscription?.billing_details?.billing_contact || null,
        tax_info: subscription?.billing_details?.tax_info || null,
        // 🆕 Grace period info (same structure as individual users)
        grace_period_info: gracePeriodInfo,
      };
    }

    res.status(200).json({
      success: true,
      subscription: {
        license_code: licenseInfo.license_code,
        account_type: licenseInfo.account_type,
        license_source: licenseInfo.source,
        license_details: license,
        ...additionalInfo,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription',
      error: error.message,
    });
  }
};

/**
 * Get user/organization features with usage stats
 * Handles both individual and company accounts
 */
export const getOrganizationFeatures = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_REQUIRED',
      });
    }

    const summary = await getFeatureAccessSummary(userId, organizationId);

    if (!summary.hasSubscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found',
        needsSetup: true,
      });
    }

    // Get feature details
    const featureCodes = summary.features.map((f) => f.feature_code);
    const featureDetails = await Feature.find({
      feature_code: { $in: featureCodes },
      is_active: true,
      view: { $ne: false },
    }).lean();

    const featureMap = {};
    featureDetails.forEach((f) => {
      featureMap[f.feature_code] = f;
    });

    const enrichedFeatures = summary.features.map((f) => ({
      ...f,
      ...featureMap[f.feature_code],
    }));

    // Group by category
    const featuresByCategory = {};
    enrichedFeatures.forEach((feature) => {
      if (!featuresByCategory[feature.category]) {
        featuresByCategory[feature.category] = [];
      }
      featuresByCategory[feature.category].push(feature);
    });

    res.status(200).json({
      success: true,
      subscription: {
        license_code: summary.license_code,
        account_type: summary.account_type,
        license_source: summary.license_source,
      },
      features: featuresByCategory,
    });
  } catch (error) {
    console.error('❌ Error fetching organization features:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching features',
      error: error.message,
    });
  }
};

/**
 * Upgrade subscription
 * Individual account: Updates user.license_code
 * Company account: Updates organization.license_code and subscription
 */
export const upgradeSubscription = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const { license_code, billing_cycle, seats, account_type } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_REQUIRED',
      });
    }

    // Validate license
    const targetLicense = await License.findOne({
      license_code: license_code.toUpperCase(),
      is_active: true,
    });

    if (!targetLicense) {
      return res.status(404).json({
        success: false,
        message: 'Invalid license code',
      });
    }

    // Individual account upgrade
    if (account_type === 'individual') {
      console.log(`\n🔄 ========== INDIVIDUAL ACCOUNT UPGRADE START ==========`);
      console.log(`👤 User ID: ${userId}`);
      console.log(`📦 Target License: ${license_code}`);
      console.log(`<RecurringTaskIcon size={size} className="flex-shrink-0" /> Billing Cycle: ${billing_cycle}`);

      const user = await User.findById(userId);

      if (!user) {
        console.log(`❌ User not found: ${userId}`);
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      console.log(`✅ User found: ${user.email}`);
      console.log(`📊 Current license_code: ${user.license_code || 'N/A'}`);
      console.log(`📊 Current license_expiry: ${user.license_expiry ? user.license_expiry.toISOString() : 'N/A'}`);

      // ✅ SINGLE SOURCE OF TRUTH: Fetch license definition for duration
      const { License } = await import('../modals/licenseModal.js');
      const licenseDef = await License.findOne({ license_code: license_code.toUpperCase() });

      // Calculate expiry date based on billing cycle
      const now = new Date();
      const expiryDate = new Date(now);

      let daysToAdd = 30; // Default fallback for MONTHLY

      if (licenseDef) {
        if (billing_cycle === 'YEARLY') {
          daysToAdd = 365;
        } else {
          daysToAdd = 30; // Standard monthly
        }
      }

      expiryDate.setDate(expiryDate.getDate() + daysToAdd);

      console.log(`⏰ Current Date: ${now.toISOString()}`);
      console.log(`📅 Calculated Expiry Date: ${expiryDate.toISOString()}`);
      console.log(`📊 Days Added: ${daysToAdd} (from ${licenseDef ? 'license def' : 'default'})`);

      user.account_type = 'individual';
      user.license_code = license_code.toUpperCase();
      user.license_expiry = expiryDate;
      user.subscription_end_date = expiryDate;

      console.log(`\n💾 Saving User document...`);
      await user.save({ validateBeforeSave: false });
      console.log(`✅ User document saved successfully`);

      console.log(`\n✅ ========== INDIVIDUAL LICENSE UPGRADE COMPLETE ==========`);
      console.log(`📦 License: ${license_code.toUpperCase()}`);
      console.log(`📅 Expiry: ${expiryDate.toISOString()}`);
      console.log(`👤 User: ${user.email}`);
      console.log(`<RecurringTaskIcon size={size} className="flex-shrink-0" /> Billing: ${billing_cycle}`);
      console.log(`===========================================================\n`);

      return res.status(200).json({
        success: true,
        message: 'Individual license upgraded successfully',
        subscription: {
          license_code: user.license_code,
          account_type: 'individual',
          user_name: `${user.firstName} ${user.lastName}`,
          expiry_date: expiryDate,
        },
      });
    }

    // Company account upgrade (requires org_admin role)
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization required for company account upgrade',
      });
    }

    // Update organization license
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    organization.license_code = license_code.toUpperCase();
    await organization.save();

    // Update or create subscription
    let subscription = await OrganizationSubscription.findOne({
      organization_id: organizationId,
    });

    // ✅ SINGLE SOURCE OF TRUTH: Fetch license definition for duration
    const { License } = await import('../modals/licenseModal.js');
    const licenseDef = await License.findOne({ license_code: license_code.toUpperCase() });

    let daysToAdd = billing_cycle === 'YEARLY' ? 365 : 30;

    if (!subscription) {
      subscription = new OrganizationSubscription({
        organization_id: organizationId,
        license_code: license_code.toUpperCase(),
        status: 'ACTIVE',
        billing_cycle: billing_cycle || 'MONTHLY',
        seats_purchased: seats || licenseDef?.max_users,
        subscription_start_date: new Date(),
        next_billing_date: new Date(
          Date.now() + (daysToAdd) * 24 * 60 * 60 * 1000
        ),
      });
    } else {
      subscription.license_code = license_code.toUpperCase();
      subscription.status = 'ACTIVE';
      subscription.billing_cycle = billing_cycle || subscription.billing_cycle;
      subscription.seats_purchased = seats || subscription.seats_purchased;

      if (subscription.status === 'EXPIRED' || subscription.status === 'ACTIVE') {
        subscription.subscription_start_date = new Date();
        subscription.next_billing_date = new Date(
          Date.now() + (daysToAdd) * 24 * 60 * 60 * 1000
        );
      }
    }

    await subscription.save();

    res.status(200).json({
      success: true,
      message: 'Company subscription upgraded successfully',
      subscription: {
        license_code: organization.license_code,
        account_type: 'company',
        organization_name: organization.name,
        seats_purchased: subscription.seats_purchased,
        billing_cycle: subscription.billing_cycle,
      },
    });
  } catch (error) {
    console.error('❌ Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error upgrading subscription',
      error: error.message,
    });
  }
};

/**
 * Downgrade organization subscription
 */
export const downgradeSubscription = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const { license_code } = req.body;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Organization not found',
        error: 'ORGANIZATION_REQUIRED',
      });
    }

    const subscription = await OrganizationSubscription.findOne({
      organization_id: organizationId,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found',
      });
    }

    subscription.license_code = license_code.toUpperCase();
    await subscription.save();

    res.status(200).json({
      success: true,
      message: 'Subscription downgraded successfully',
      subscription,
    });
  } catch (error) {
    console.error('❌ Error downgrading subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error downgrading subscription',
      error: error.message,
    });
  }
};

/**
 * Initialize trial subscription for new organization
 */
export const initializeTrial = async (req, res) => {
  try {
    const { organization_id } = req.body;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required',
      });
    }

    // Check if subscription already exists
    const existingSubscription = await OrganizationSubscription.findOne({
      organization_id,
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Subscription already exists',
        subscription: existingSubscription,
      });
    }

    const subscription = await OrganizationSubscription.initializeTrial(
      organization_id
    );

    res.status(201).json({
      success: true,
      message: 'Trial subscription initialized',
      subscription,
    });
  } catch (error) {
    console.error('❌ Error initializing trial:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing trial',
      error: error.message,
    });
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const { cancellation_reason } = req.body;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Organization not found',
        error: 'ORGANIZATION_REQUIRED',
      });
    }

    const subscription = await OrganizationSubscription.findOne({
      organization_id: organizationId,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found',
      });
    }

    subscription.status = 'CANCELLED';
    subscription.cancelled_at = new Date();
    subscription.cancellation_reason = cancellation_reason || 'User requested';
    subscription.auto_renew = false;

    await subscription.save();

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription,
    });
  } catch (error) {
    console.error('❌ Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling subscription',
      error: error.message,
    });
  }
};

/**
 * Purchase additional license seats for organization
 * Allows adding more seats to existing subscription
 */
export const purchaseAdditionalSeats = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const { additional_seats } = req.body;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Organization not found',
        error: 'ORGANIZATION_REQUIRED',
      });
    }

    if (!additional_seats || additional_seats < 1) {
      return res.status(400).json({
        success: false,
        message: 'Please specify number of seats to purchase (minimum 1)',
      });
    }

    const subscription = await OrganizationSubscription.findOne({
      organization_id: organizationId,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found. Please create a subscription first.',
      });
    }

    // Get license pricing
    const license = await License.findOne({
      license_code: subscription.license_code,
    });

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'License not found',
      });
    }

    // Calculate cost for additional seats
    const pricePerSeat = subscription.billing_cycle === 'YEARLY'
      ? license.price_yearly
      : license.price_monthly;

    const totalCost = pricePerSeat * additional_seats;

    // Update seats
    subscription.seats_purchased += additional_seats;
    subscription.total_amount_paid += totalCost;
    subscription.last_payment_date = new Date();

    await subscription.save();

    res.status(200).json({
      success: true,
      message: `Successfully purchased ${additional_seats} additional seat(s)`,
      subscription: {
        seats_purchased: subscription.seats_purchased,
        seats_used: subscription.seats_used,
        seats_available: subscription.getAvailableSeats(),
        total_cost: totalCost,
        price_per_seat: pricePerSeat,
        billing_cycle: subscription.billing_cycle,
      },
    });
  } catch (error) {
    console.error('❌ Error purchasing additional seats:', error);
    res.status(500).json({
      success: false,
      message: 'Error purchasing additional seats',
      error: error.message,
    });
  }
};

/**
 * Get organization seat usage summary
 */
export const getSeatUsageSummary = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Organization not found',
        error: 'ORGANIZATION_REQUIRED',
      });
    }

    const subscription = await OrganizationSubscription.findOne({
      organization_id: organizationId,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found',
      });
    }

    // Get list of users assigned to organization
    const users = await User.find({
      organization_id: organizationId,
      status: { $in: ['active', 'invited'] },
    }).select('firstName lastName email status role invitedAt');

    res.status(200).json({
      success: true,
      summary: {
        seats_purchased: subscription.seats_purchased,
        seats_used: subscription.seats_used,
        seats_available: subscription.getAvailableSeats(),
        license_code: subscription.license_code,
        status: subscription.status,
        billing_cycle: subscription.billing_cycle,
        users: users.map(u => ({
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          status: u.status,
          role: u.role,
          invited_at: u.invitedAt,
        })),
      },
    });
  } catch (error) {
    console.error('❌ Error getting seat usage summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting seat usage',
      error: error.message,
    });
  }
};

/**
 * Get organization invoices (Billing History)
 * Handles both individual and company accounts
 */
export const getInvoices = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const { page = 1, limit = 10, status } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_REQUIRED',
      });
    }

    // Get effective license to determine account type
    const licenseInfo = await getEffectiveLicense(userId, organizationId);
    const isIndividual = licenseInfo.account_type === 'individual' || !organizationId;

    let result;
    if (isIndividual) {
      result = await Invoice.getUserInvoices(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null,
      });
    } else {
      result = await Invoice.getOrganizationInvoices(organizationId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null,
      });
    }

    // 🆕 FALLBACK: If no formal invoices found, check TransactionHistory (for legacy or missing records)
    if (!result.invoices || result.invoices.length === 0) {
      console.log(`ℹ️ No invoices found for ${isIndividual ? 'individual' : 'company'}, checking TransactionHistory...`);
      const transactionQuery = isIndividual
        ? { user_id: userId, status: 'COMPLETED' }
        : { organization_id: organizationId, status: 'COMPLETED' };

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [transactions, total] = await Promise.all([
        TransactionHistory.find(transactionQuery)
          .populate('user_id', 'firstName lastName')
          .sort({ transaction_date: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        TransactionHistory.countDocuments(transactionQuery)
      ]);

      if (transactions.length > 0) {
        result = {
          invoices: transactions.map(t => ({
            _id: t._id,
            invoice_number: t.transaction_id,
            created_at: t.transaction_date,
            total_amount: t.amount_paid || t.final_amount || 0,
            payment_status: 'paid',
            license_code: t.license_code || 'N/A',
            billing_cycle: t.billing_cycle || 'MONTHLY',
            is_transaction: true,
            billing_name: t.user_id ? `${t.user_id.firstName || ''} ${t.user_id.lastName || ''}`.trim() : (t.license_name || 'License Purchase')
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }
    }

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices',
      error: error.message,
    });
  }
};

/**
 * Get single invoice by ID
 */
export const getInvoiceById = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const { invoiceId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_REQUIRED',
      });
    }

    let invoice = await Invoice.findById(invoiceId).lean();

    if (!invoice) {
      // Fallback to TransactionHistory
      const transaction = await TransactionHistory.findById(invoiceId)
        .populate('user_id', 'firstName lastName email')
        .populate('billing_detail_id')
        .lean();

      if (transaction) {
        invoice = {
          _id: transaction._id,
          invoice_number: transaction.transaction_id,
          created_at: transaction.transaction_date,
          total_amount: transaction.amount_paid || transaction.final_amount || 0,
          payment_status: 'paid',
          license_code: transaction.license_code,
          billing_cycle: transaction.billing_cycle,
          billing_name: transaction.billing_detail_id?.card_holder_name ||
            (transaction.user_id ? `${transaction.user_id.firstName || ''} ${transaction.user_id.lastName || ''}`.trim() : transaction.license_name),
          billing_email: transaction.billing_detail_id?.billing_contact?.contact_email || transaction.user_id?.email || '',
          billing_address: transaction.billing_detail_id?.tax_info?.billing_address || 'Not Provided',
          billing_gstin: transaction.billing_detail_id?.tax_info?.gst_number || null,
          payment_method: transaction.payment_method || 'RAZORPAY',
          razorpay_payment_id: transaction.razorpay_payment_id,
          user_id: transaction.user_id?._id || transaction.user_id,
          organization_id: transaction.organization_id,
          is_transaction: true,
          subtotal: transaction.total_price || 0,
          discount_amount: transaction.discount_amount || 0,
          tax_amount: transaction.tax_amount || 0
        };
      }
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // Verify user has access to this invoice
    const licenseInfo = await getEffectiveLicense(userId, organizationId);

    if (licenseInfo.account_type === 'individual') {
      if (invoice.user_id?.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this invoice',
        });
      }
    } else {
      if (invoice.organization_id?.toString() !== organizationId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this invoice',
        });
      }
    }

    res.status(200).json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error('❌ Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice',
      error: error.message,
    });
  }
};

/**
 * Download invoice as PDF data (frontend generates PDF)
 */
export const downloadInvoice = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const { invoiceId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_REQUIRED',
      });
    }

    let invoice = await Invoice.findById(invoiceId)
      .populate('organization_id', 'name address')
      .populate('user_id', 'firstName lastName email')
      .lean();

    if (!invoice) {
      // Fallback to TransactionHistory
      const transaction = await TransactionHistory.findById(invoiceId)
        .populate('organization_id', 'name address')
        .populate('user_id', 'firstName lastName email')
        .populate('billing_detail_id')
        .lean();

      if (transaction) {
        invoice = {
          ...transaction,
          invoice_number: transaction.transaction_id,
          created_at: transaction.transaction_date,
          total_amount: transaction.amount_paid || transaction.final_amount || 0,
          subtotal: transaction.total_price || 0,
          discount_amount: transaction.discount_amount || 0,
          tax_amount: transaction.tax_amount || 0,
          billing_name: transaction.billing_detail_id?.card_holder_name ||
            (transaction.user_id ? `${transaction.user_id.firstName || ''} ${transaction.user_id.lastName || ''}`.trim() : transaction.license_name),
          billing_email: transaction.billing_detail_id?.billing_contact?.contact_email || transaction.user_id?.email || '',
          billing_address: transaction.billing_detail_id?.tax_info?.billing_address || 'Not Provided',
          billing_gstin: transaction.billing_detail_id?.tax_info?.gst_number || null,
          payment_status: 'paid',
          is_transaction: true
        };
      }
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // Verify user has access
    const licenseInfo = await getEffectiveLicense(userId, organizationId);

    if (licenseInfo.account_type === 'individual') {
      if (invoice.user_id?._id?.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }
    } else {
      if (invoice.organization_id?._id?.toString() !== organizationId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }
    }

    // Return invoice data for PDF generation
    res.status(200).json({
      success: true,
      invoice: {
        ...invoice,
        formatted_amount: `₹${invoice.total_amount.toFixed(2)}`,
        formatted_subtotal: `₹${invoice.subtotal.toFixed(2)}`,
        formatted_tax: `₹${invoice.tax_amount.toFixed(2)}`,
        formatted_discount: `₹${invoice.discount_amount.toFixed(2)}`,
      },
    });
  } catch (error) {
    console.error('❌ Error downloading invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading invoice',
      error: error.message,
    });
  }
};

/**
 * Validate usage limits before downgrade
 * Returns issues if current usage exceeds target plan limits
 */
export const validateDowngrade = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const { target_license_code } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_REQUIRED',
      });
    }

    if (!target_license_code) {
      return res.status(400).json({
        success: false,
        message: 'Target license code is required',
      });
    }

    // Get current license
    const licenseInfo = await getEffectiveLicense(userId, organizationId);

    // Get target license features
    const targetFeatures = await LicenseFeatureMapping.find({
      license_code: target_license_code.toUpperCase(),
      is_enabled: true,
    }).lean();

    const targetLimits = {};
    targetFeatures.forEach(f => {
      targetLimits[f.feature_code] = {
        limit: f.usage_limit,
        limit_type: f.limit_type,
        is_enabled: f.is_enabled,
      };
    });

    // Get current usage for the entity
    const usageRecords = await FeatureUsageTracking.getEntityUsage(
      licenseInfo.entity_id,
      'MONTHLY',
      licenseInfo.account_type
    );

    // Check each feature for over-limit issues
    const issues = [];
    const featuresToCheck = ['TASK_BASIC', 'TASK_SUB', 'FORM_CREATE', 'PROC_CREATE', 'TASK_RECUR', 'TASK_MSTONE'];

    for (const featureCode of featuresToCheck) {
      const usage = usageRecords.find(u => u.feature_code === featureCode);
      const targetLimit = targetLimits[featureCode];

      if (usage && targetLimit) {
        // Feature disabled in target plan
        if (!targetLimit.is_enabled && usage.usage_count > 0) {
          issues.push({
            feature_code: featureCode,
            issue_type: 'feature_disabled',
            current_usage: usage.usage_count,
            target_limit: 0,
            message: `${featureCode} is not available in ${target_license_code}. You currently have ${usage.usage_count} items.`,
          });
        }
        // Usage exceeds target limit
        else if (targetLimit.limit > 0 && usage.usage_count > targetLimit.limit) {
          issues.push({
            feature_code: featureCode,
            issue_type: 'over_limit',
            current_usage: usage.usage_count,
            target_limit: targetLimit.limit,
            message: `${featureCode}: Current usage (${usage.usage_count}) exceeds ${target_license_code} limit (${targetLimit.limit}).`,
          });
        }
      }
    }

    // Check seats for company accounts
    if (licenseInfo.account_type === 'company') {
      const subscription = await OrganizationSubscription.findOne({
        organization_id: organizationId,
      });

      const targetLicense = await License.findOne({
        license_code: target_license_code.toUpperCase(),
      });

      if (subscription && targetLicense && targetLicense.max_users !== -1) {
        if (subscription.seats_used > targetLicense.max_users) {
          issues.push({
            feature_code: 'MAX_USERS',
            issue_type: 'over_limit',
            current_usage: subscription.seats_used,
            target_limit: targetLicense.max_users,
            message: `Your team has ${subscription.seats_used} users but ${target_license_code} only allows ${targetLicense.max_users} users.`,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      can_downgrade: issues.length === 0,
      current_license: licenseInfo.license_code,
      target_license: target_license_code.toUpperCase(),
      issues,
      message: issues.length > 0
        ? 'Please resolve the following issues before downgrading'
        : 'You can proceed with the downgrade',
    });
  } catch (error) {
    console.error('❌ Error validating downgrade:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating downgrade',
      error: error.message,
    });
  }
};

/**
 * Validate coupon code
 * POST /api/license/validate-coupon
 */
export const validateCoupon = async (req, res) => {
  try {
    const { code } = req.body;

    // Validate input
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required',
      });
    }

    // Find coupon (case-insensitive)
    const coupon = await Coupon.findOne({
      code: code.trim().toUpperCase()
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code',
      });
    }

    // Check if coupon is valid using the model method
    if (!coupon.isValid()) {
      let reason = 'Coupon is no longer valid';

      if (!coupon.valid) {
        reason = 'Coupon has been deactivated';
      } else if (coupon.expires_at < new Date()) {
        reason = 'Coupon has expired';
      } else if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
        reason = 'Coupon usage limit reached';
      }

      return res.status(400).json({
        success: false,
        message: reason,
      });
    }

    // Return valid coupon details
    res.status(200).json({
      success: true,
      coupon: {
        code: coupon.code,
        discount: coupon.discount,
        valid: true,
        expires_at: coupon.expires_at,
        description: coupon.description || `Get ${coupon.discount}% off`,
        applicable_plans: coupon.applicable_plans,
      },
    });
  } catch (error) {
    console.error('❌ Error validating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating coupon',
      error: error.message,
    });
  }
};

/**
 * 🆕 POST /api/admin/license/override
 * Super Admin: Override license for any organization/user
 * Allows manual license assignment and expiry extension
 * 
 * Request Body:
 * {
 *   "entity_type": "COMPANY",
 *   "entity_id": "507f1f77bcf86cd799439011",
 *   "license_code": "OPTIMIZE",
 *   "extend_days": 14,
 *   "reason": "Promotional extension"
 * }
 */
export const overrideLicense = async (req, res) => {
  try {
    const adminUserId = req.user?._id || req.user?.userId;
    const adminUser = await User.findById(adminUserId);

    // Only super_admin can override licenses
    if (!adminUser || adminUser.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin only.',
        error: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    const { entity_type, entity_id, license_code, extend_days, reason } = req.body;

    // Validate required fields
    if (!entity_type || !entity_id) {
      return res.status(400).json({
        success: false,
        message: 'entity_type and entity_id are required',
      });
    }

    if (!['USER', 'COMPANY'].includes(entity_type)) {
      return res.status(400).json({
        success: false,
        message: 'entity_type must be USER or COMPANY',
      });
    }

    // Validate license code if provided
    if (license_code) {
      const licenseExists = await License.findOne({
        license_code: license_code.toUpperCase(),
        is_active: true
      });

      if (!licenseExists) {
        return res.status(400).json({
          success: false,
          message: `Invalid license code: ${license_code}`,
        });
      }
    }

    if (entity_type === 'USER') {
      // Override for individual user
      const user = await User.findById(entity_id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Update user license
      if (license_code) {
        user.license_code = license_code.toUpperCase();
      }

      // Extend expiry if requested
      if (extend_days && extend_days > 0) {
        const currentExpiry = user.subscription_end_date || new Date();
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + extend_days);
        user.subscription_end_date = newExpiry;
      }

      await user.save({ validateBeforeSave: false });

      console.log(`✅ [ADMIN OVERRIDE] User license updated by ${adminUser.email}:`, {
        user_id: entity_id,
        new_license: license_code,
        extended_days: extend_days,
        reason: reason,
      });

      return res.status(200).json({
        success: true,
        message: 'User license override successful',
        data: {
          entity_type: 'USER',
          entity_id: entity_id,
          new_license: user.license_code,
          expiry_date: user.subscription_end_date,
          overridden_by: adminUser.email,
          reason: reason,
        },
      });
    }

    if (entity_type === 'COMPANY') {
      // Override for organization
      let subscription = await OrganizationSubscription.findOne({
        organization_id: entity_id,
      });

      if (!subscription) {
        // Create new subscription if doesn't exist
        const organization = await Organization.findById(entity_id);

        if (!organization) {
          return res.status(404).json({
            success: false,
            message: 'Organization not found',
          });
        }

        subscription = new OrganizationSubscription({
          organization_id: entity_id,
          license_code: license_code?.toUpperCase() || 'EXPLORE',
          status: 'ACTIVE',
          subscription_start_date: new Date(),
          billing_cycle: 'MONTHLY',
          seats_purchased: 10,
          seats_available: 10,
        });
      }

      // Update license code
      if (license_code) {
        subscription.license_code = license_code.toUpperCase();
      }

      // Extend subscription
      if (extend_days && extend_days > 0) {
        const currentExpiry = subscription.subscription_end_date || new Date();
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + extend_days);
        subscription.subscription_end_date = newExpiry;
        subscription.status = 'ACTIVE';
      }

      // Record override metadata
      subscription.override_reason = reason || 'Super admin manual override';
      subscription.overridden_by = adminUserId;
      subscription.overridden_at = new Date();

      await subscription.save();

      console.log(`✅ [ADMIN OVERRIDE] Organization license updated by ${adminUser.email}:`, {
        organization_id: entity_id,
        new_license: license_code,
        extended_days: extend_days,
        reason: reason,
      });

      return res.status(200).json({
        success: true,
        message: 'Organization license override successful',
        data: {
          entity_type: 'COMPANY',
          entity_id: entity_id,
          new_license: subscription.license_code,
          status: subscription.status,
          expiry_date: subscription.subscription_end_date,
          overridden_by: adminUser.email,
          reason: reason || subscription.override_reason,
        },
      });
    }
  } catch (error) {
    console.error('❌ Error in license override:', error);
    res.status(500).json({
      success: false,
      message: 'Error overriding license',
      error: error.message,
    });
  }
};
/**
 * ================================
 * 🆕 NEW USER-LEVEL LICENSE MANAGEMENT APIs
 * ================================
 */

/**
 * GET /api/license/user/:userId
 * Get license info for a specific user (Primary Admin or Super Admin only)
 */
export const getUserLicenseInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUserId = req.user?.id || req.user?._id || req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Get requesting user to check permissions
    const adminUser = await User.findById(adminUserId);
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check authorization: must be same org's Admin (Primary/Secondary) or Super Admin
    const isSuperAdmin = adminUser?.role?.includes('super_admin');
    const isPrimaryAdmin = adminUser?.isPrimaryAdmin;
    const isOrgAdmin = adminUser?.role?.includes('org_admin');
    const sameOrg = adminUser?.organization_id?.toString() === targetUser?.organization_id?.toString();

    // ✅ Self-view always allowed
    const isSelf = adminUserId.toString() === userId.toString();

    // ✅ NEW: Secondary org_admin can view users in same org, but not Primary Admin's license
    if (!isSuperAdmin && !isSelf) {
      // Primary Admin can view anyone in same org
      if (isPrimaryAdmin && sameOrg) {
        // Allowed
      }
      // Secondary org_admin can view anyone in same org except Primary Admin
      else if (isOrgAdmin && sameOrg) {
        if (targetUser.isPrimaryAdmin) {
          return res.status(403).json({
            success: false,
            message: 'Secondary admin cannot view Primary Admin\'s license details',
          });
        }
        // Allowed for non-primary users
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this user\'s license',
        });
      }
    }

    const licenseInfo = await licenseService.getUserLicenseInfo(userId);

    res.status(200).json({
      success: true,
      user: {
        id: targetUser._id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        role: targetUser.role,
        isPrimaryAdmin: targetUser.isPrimaryAdmin,
      },
      license: licenseInfo,
    });
  } catch (error) {
    console.error('❌ Error getting user license info:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user license info',
      error: error.message,
    });
  }
};

/**
 * GET /api/license/organization/pool
 * Get company's license pool summary (Primary Admin only)
 */
export const getCompanyLicensePool = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    // Get user to check if Primary Admin
    const user = await User.findById(userId);
    if (!user?.isPrimaryAdmin && !user?.role?.includes('super_admin') && !user?.role?.includes('org_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only Primary Admin or Org Admin can view license pool',
      });
    }

    const poolSummary = await licenseService.getCompanyLicensePoolSummary(organizationId);

    res.status(200).json({
      success: true,
      ...poolSummary,
    });
  } catch (error) {
    console.error('❌ Error getting company license pool:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting company license pool',
      error: error.message,
    });
  }
};

/**
 * POST /api/license/assign
 * Assign a license from company pool to a user (Primary Admin only)
 * 
 * Body: { targetUserId: string, licenseCode: string }
 */
export const assignLicenseToUser = async (req, res) => {
  try {
    const adminUserId = req.user?.id || req.user?._id || req.user?.userId;
    const { targetUserId, licenseCode } = req.body;

    if (!targetUserId || !licenseCode) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID and license code are required',
      });
    }

    // Assign license using service
    const result = await licenseService.assignLicenseToUser(adminUserId, targetUserId, licenseCode);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        reason: result.reason,
        violations: result.violations || [], // Include usage violations for downgrade
        isDowngrade: result.isDowngrade || false,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      licenseInstance: result.licenseInstance,
      isUpgrade: result.isUpgrade || false,
      isDowngrade: result.isDowngrade || false,
      previousLicense: result.previousLicense,
    });
  } catch (error) {
    console.error('❌ Error assigning license:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning license',
      error: error.message,
    });
  }
};

/**
 * POST /api/license/unassign
 * Release a user's license back to company pool (Primary Admin only)
 * 
 * Body: { targetUserId: string }
 */
export const unassignLicenseFromUser = async (req, res) => {
  try {
    const adminUserId = req.user?.id || req.user?._id || req.user?.userId;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required',
      });
    }

    // Unassign license using service
    const result = await licenseService.unassignLicenseFromUser(adminUserId, targetUserId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        reason: result.reason,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('❌ Error unassigning license:', error);
    res.status(500).json({
      success: false,
      message: 'Error unassigning license',
      error: error.message,
    });
  }
};

/**
 * POST /api/license/check-assign
 * Check if admin can assign a license to a user (for UI validation)
 * 
 * Body: { targetUserId: string, licenseCode: string }
 */
export const checkCanAssignLicense = async (req, res) => {
  try {
    const adminUserId = req.user?.id || req.user?._id || req.user?.userId;
    const { targetUserId, licenseCode } = req.body;

    if (!targetUserId || !licenseCode) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID and license code are required',
      });
    }

    const result = await licenseService.canAssignLicense(adminUserId, targetUserId, licenseCode);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Error checking license assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking license assignment',
      error: error.message,
    });
  }
};

/**
 * POST /api/license/validate-change
 * Validate if a license change (upgrade/downgrade) is allowed
 * 
 * ✅ Key Rules:
 * - Upgrade: Always allowed (usage carries forward)
 * - Downgrade: Only allowed if usage fits target limits
 * 
 * Body: { targetUserId: string, targetLicenseCode: string }
 */
export const validateLicenseChange = async (req, res) => {
  try {
    const { targetUserId, targetLicenseCode } = req.body;

    if (!targetUserId || !targetLicenseCode) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID and target license code are required',
      });
    }

    // Get user's current license
    const currentLicenseInfo = await licenseService.getUserLicenseInfo(targetUserId);
    const currentLicenseCode = currentLicenseInfo?.license_code || 'EXPLORE';

    // Validate the license change
    const result = await licenseService.validateLicenseChange(
      targetUserId,
      currentLicenseCode,
      targetLicenseCode
    );

    res.status(200).json({
      success: true,
      currentLicense: currentLicenseCode,
      targetLicense: targetLicenseCode,
      ...result,
    });
  } catch (error) {
    console.error('❌ Error validating license change:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating license change',
      error: error.message,
    });
  }
};

/**
 * POST /api/license/check-downgrade
 * Check if user can be downgraded to a lower tier license
 * 
 * Body: { targetUserId: string, targetLicenseCode: string }
 */
export const checkDowngradeEligibility = async (req, res) => {
  try {
    const { targetUserId, targetLicenseCode } = req.body;

    if (!targetUserId || !targetLicenseCode) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID and target license code are required',
      });
    }

    const result = await licenseService.checkDowngradeEligibility(targetUserId, targetLicenseCode);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Error checking downgrade eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking downgrade eligibility',
      error: error.message,
    });
  }
};

/**
 * GET /api/license/organization/users
 * Get all users in organization with their license info (Primary Admin only)
 */
export const getOrganizationUsersWithLicenses = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    // Get user to check permissions
    const user = await User.findById(userId);
    if (!user?.isPrimaryAdmin && !user?.role?.includes('super_admin') && !user?.role?.includes('org_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only Primary Admin or Org Admin can view organization users',
      });
    }

    // Get all users in organization
    const users = await User.find({ organization_id: organizationId })
      .select('firstName lastName email role isPrimaryAdmin status license_instance_id license_code assigned_license createdAt')
      .populate('license_instance_id')
      .lean();

    // Enrich with license info
    const usersWithLicenses = await Promise.all(users.map(async (u) => {
      const licenseInfo = await licenseService.getUserLicenseInfo(u._id);
      return {
        ...u,
        licenseInfo,
      };
    }));

    res.status(200).json({
      success: true,
      users: usersWithLicenses,
      totalUsers: users.length,
    });
  } catch (error) {
    console.error('❌ Error getting organization users:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting organization users',
      error: error.message,
    });
  }
};