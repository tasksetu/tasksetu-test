/**
 * LICENSE SERVICE - HEART OF THE MODULE (v3 - USER-LEVEL LICENSING WITH FEATURE-BASED USAGE)
 * 
 * ✅ CORE PRINCIPLES (FINAL & AUTHORITATIVE):
 * 
 * 🔑 Rule 1 — LicenseInstance is ACCESS, not USAGE
 *    - LicenseInstance only decides which limits apply
 *    - Usage is per user, not per license instance
 * 
 * 🔑 Rule 2 — Usage is FEATURE-based
 *    - Usage tracked in UserFeatureUsage model
 *    - Independent of license assignment
 * 
 * 🔑 Rule 3 — Upgrade NEVER deletes usage
 *    - Only changes the ceiling (limits)
 *    - Usage carries forward
 * 
 * 🔑 Rule 4 — Downgrade is VALIDATED, not forced
 *    - Only allowed if current usage fits target license limits
 * 
 * REQUEST → USER LICENSE CHECK → FEATURE CHECK → USER LIMIT CHECK → ALLOW / BLOCK
 * 
 * This service exposes these methods:
 * - checkFeatureAccess(userId, feature_code)
 * - checkFeatureLimit(userId, feature_code)
 * - consumeFeature(userId, feature_code, amount)
 * - decrementFeature(userId, feature_code, amount) - for delete/undo
 * - getLicenseSummary(userId)
 * - getUserLicenseInfo(userId)
 * - canAssignLicense(adminUserId, targetUserId, targetLicenseCode)
 * - assignLicenseToUser(adminUserId, targetUserId, licenseCode)
 * - validateLicenseChange(userId, currentLicense, targetLicense)
 * - checkDowngradeEligibility(userId, targetLicenseCode)
 */

import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';
import { LicenseFeatureMapping } from '../modals/licenseFeatureMappingModal.js';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import { UserFeatureUsage } from '../modals/userFeatureUsageModal.js';
import { License } from '../modals/licenseModal.js';
import LicenseInstance from '../modals/licenseInstanceModal.js';
import mongoose from 'mongoose';
import { PLAN_ORDER_UPPERCASE } from '../utils/licenseConstants.js';

// License hierarchy for upgrade/downgrade detection (lower index = lower tier)
const LICENSE_HIERARCHY = PLAN_ORDER_UPPERCASE;

// Friendly display names for feature codes
const FEATURE_DISPLAY_NAMES = {
  TASK_BASIC: 'Tasks',
  TASK_RECUR: 'Recurring Tasks',
  TASK_APPROVAL: 'Approval Tasks',
  TASK_MSTONE: 'Milestone Tasks',
  TASK_SUB: 'Sub Tasks',
  PROC_CREATE: 'Processes',
  FORM_CREATE: 'Forms',
};

export const getFeatureDisplayName = (featureCode) => {
  return FEATURE_DISPLAY_NAMES[featureCode] || featureCode;
};

/**
 * Get trial days from License model dynamically
 * @param {String} licenseCode - License code (e.g., 'EXPLORE')
 * @returns {Promise<Number>} Number of trial days
 */
export const getTrialDays = async (licenseCode = 'EXPLORE') => {
  try {
    const license = await License.findOne({ license_code: licenseCode });
    const trialDays = license?.trial_days || 6; // Default fallback to 6 days
    console.log(`📅 Trial days for ${licenseCode}: ${trialDays}`);
    return trialDays;
  } catch (error) {
    console.error('❌ Error fetching trial_days, using default 6:', error);
    return 6; // Safe fallback
  }
};

/**
 * ✅ NEW: Get user's own license information (USER-LEVEL, no inheritance)
 * 
 * SINGLE SOURCE OF TRUTH: users.license_instance_id OR users.license_code
 * 
 * @param {ObjectId|String} userId - User ID
 * @returns {Promise<Object>} User's license details
 */
const getUserLicense = async (userId) => {
  try {
    // Fetch user with license instance populated
    const user = await User.findById(userId).populate('license_instance_id');

    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();

    // ✅ PRIORITY 1: Check license_instance_id (NEW atomic model — used by org users)
    if (user.license_instance_id && user.license_instance_id.license_code) {
      const instance = user.license_instance_id;

      // Check if license instance is expired
      const isExpired = instance.renewal_date && instance.renewal_date < now;

      if (isExpired) {
        // 🆕 Check if there is a pending downgrade plan. If yes, activate it immediately (no grace period)
        if (user.pending_license?.license_code && user.pending_license.is_downgrade) {
          console.log(`🔄 Org user ${userId} has a pending downgrade plan, bypassing grace period and activating it now`);

          // Release/expire the license instance
          instance.status = 'EXPIRED';
          instance.assigned_to = null;
          await instance.save();

          user.license_code = user.pending_license.license_code;
          user.license_expiry = user.pending_license.scheduled_end_date;
          user.license_instance_id = null;
          user.pending_license = {
            license_code: null,
            billing_cycle: null,
            scheduled_start_date: null,
            scheduled_end_date: null,
            payment_id: null,
            is_downgrade: false,
            created_at: null,
          };
          await user.save({ validateBeforeSave: false });

          return getUserLicense(userId); // Recurse to evaluate newly assigned license
        }

        // 🆕 Check grace period before marking as fully expired
        const { License } = await import('../modals/licenseModal.js');
        const licenseDef = await License.findOne({ license_code: instance.license_code });
        const graceDays = licenseDef?.grace_period_days !== undefined ? licenseDef.grace_period_days : 5;

        const graceEnd = new Date(instance.renewal_date);
        graceEnd.setDate(graceEnd.getDate() + graceDays);

        if (now > graceEnd) {
          // Grace period is fully over — auto-downgrade this user to EXPLORE
          console.log(`🔄 Org user ${userId} grace period ended for ${instance.license_code}, auto-downgrading to EXPLORE`);

          const originalExpiry = instance.renewal_date;

          // Release/expire the license instance too!
          instance.status = 'EXPIRED';
          instance.assigned_to = null;
          await instance.save();

          user.license_expiry = originalExpiry; // Preserve original expiry so UI can show overdue days!
          user.license_instance_id = null;
          user.license_code = 'EXPLORE';
          await user.save({ validateBeforeSave: false });

          return {
            license_code: 'EXPLORE',
            status: 'EXPIRED',
            entity_type: 'USER',
            entity_id: userId,
            user_id: userId,
            expiry_date: originalExpiry, // Preserve original expiry so UI can show overdue days
            source: 'auto_downgrade',
            is_expired: true,
            account_type: user.account_type,
            billing_cycle: instance.billing_cycle || 'MONTHLY',
          };
        }

        // Still within grace period — report as expired but keep the plan active
        console.log(`⏳ Org user ${userId} in grace period for ${instance.license_code} (ends ${graceEnd.toISOString()})`);
      }

      console.log(`👤 User ${userId} using license instance: ${instance.license_code} (${isExpired ? 'EXPIRED (grace)' : instance.status})`);

      return {
        license_code: instance.license_code,
        status: isExpired ? 'EXPIRED' : instance.status,
        entity_type: 'USER',
        entity_id: userId,
        user_id: userId,
        billing_cycle: instance.billing_cycle,
        assigned_date: instance.assigned_at,
        expiry_date: instance.renewal_date,
        purchase_id: instance.purchase_id,
        license_instance_id: instance._id,
        source: 'license_instance',
        is_expired: isExpired,
        account_type: user.account_type,
      };
    }

    // ✅ PRIORITY 2: Check assigned_license (legacy - for migration period)
    if (user.assigned_license && user.assigned_license.license_code) {
      if (user.assigned_license.license_code === 'EXPLORE') {
        return {
          license_code: 'EXPLORE',
          status: 'ACTIVE',
          entity_type: 'USER',
          entity_id: userId,
          user_id: userId,
          billing_cycle: 'FREE',
          assigned_date: user.assigned_license.assigned_date,
          expiry_date: null,
          purchase_id: user.assigned_license.purchase_id,
          source: 'assigned_license',
          is_expired: false,
          account_type: user.account_type,
        };
      }

      // Calculate expiry date if not present for other licenses (should have one)
      const expiryDate = user.assigned_license.expiration_date;
      const isExpired = expiryDate && expiryDate < now;

      console.log(`👤 User ${userId} using assigned license (legacy): ${user.assigned_license.license_code}`);

      return {
        license_code: user.assigned_license.license_code,
        status: isExpired ? 'EXPIRED' : 'ACTIVE',
        entity_type: 'USER',
        entity_id: userId,
        user_id: userId,
        billing_cycle: user.assigned_license.billing_cycle || 'MONTHLY',
        assigned_date: user.assigned_license.assigned_date,
        expiry_date: expiryDate,
        purchase_id: user.assigned_license.purchase_id,
        source: 'assigned_license',
        is_expired: isExpired,
        account_type: user.account_type,
      };
    }

    // ✅ PRIORITY 3: Check user.license_code (for individual users or legacy)
    if (user.license_code) {
      // Calculate expiry date
      let expiryDate = user.subscription_end_date || user.license_expiry;
      let isExpired = false;
      let status = 'ACTIVE';

      // For EXPLORE, check if trial expired (default behavior)
      if (user.license_code === 'EXPLORE') {
        return {
          license_code: 'EXPLORE',
          status: 'ACTIVE',
          entity_type: 'USER',
          entity_id: userId,
          user_id: userId,
          expiry_date: null,
          source: 'license_code',
          is_expired: false,
          account_type: user.account_type,
          billing_cycle: 'FREE',
        };
      } else {
        // FOR OTHER LICENSES (PLAN, EXECUTE, OPTIMIZE) assigned directly to user
        if (expiryDate && expiryDate < now) {
          // 🆕 Check if there is a pending downgrade plan. If yes, activate it immediately (no grace period)
          if (user.pending_license?.license_code && user.pending_license.is_downgrade) {
            console.log(`🔄 👤 User ${userId} has a pending downgrade plan, bypassing grace period and activating it now`);
            
            user.license_code = user.pending_license.license_code;
            user.license_expiry = user.pending_license.scheduled_end_date;
            user.pending_license = {
              license_code: null,
              billing_cycle: null,
              scheduled_start_date: null,
              scheduled_end_date: null,
              payment_id: null,
              is_downgrade: false,
              created_at: null,
            };
            await user.save({ validateBeforeSave: false });
            
            return getUserLicense(userId); // Recurse to evaluate newly assigned license
          }

          // Check if grace period is also over
          const { License } = await import('../modals/licenseModal.js');
          const licenseDef = await License.findOne({ license_code: user.license_code });
          const graceDays = licenseDef?.grace_period_days !== undefined ? licenseDef.grace_period_days : 5;
          
          const graceEnd = new Date(expiryDate);
          graceEnd.setDate(graceEnd.getDate() + graceDays);
          
          if (now > graceEnd) {
             console.log(`🔄 👤 User ${userId} grace period ended for ${user.license_code}, auto-downgrading to EXPLORE`);
             
             // Auto-downgrade to EXPLORE and clear expiry
             user.license_expiry = null;
             user.license_code = 'EXPLORE';
             await user.save({ validateBeforeSave: false });
             
             return {
                license_code: 'EXPLORE',
                status: 'ACTIVE',
                entity_type: 'USER',
                entity_id: userId,
                user_id: userId,
                expiry_date: null,
                source: 'auto_downgrade',
                is_expired: false,
                account_type: user.account_type,
                billing_cycle: 'FREE',
             };
          } else {
            isExpired = true;
            status = 'EXPIRED';
          }
        }
      }

      console.log(`👤 User ${userId} using license_code: ${user.license_code} (${status})`);

      return {
        license_code: user.license_code,
        status: status,
        entity_type: 'USER',
        entity_id: userId,
        user_id: userId,
        expiry_date: expiryDate,
        source: 'license_code',
        is_expired: isExpired,
        account_type: user.account_type,
        billing_cycle: user.assigned_license?.billing_cycle || 'MONTHLY',
      };
    }

    // ✅ DEFAULT: No license assigned - Return EXPLORE permanently active
    console.log(`👤 User ${userId} has no license, defaulting to permanently active EXPLORE`);

    return {
      license_code: 'EXPLORE',
      status: 'ACTIVE',
      entity_type: 'USER',
      entity_id: userId,
      user_id: userId,
      expiry_date: null,
      source: 'default',
      is_expired: false,
      account_type: user.account_type,
      billing_cycle: 'FREE',
    };
  } catch (error) {
    console.error('❌ Error getting user license:', error);
    throw error;
  }
};

/**
 * ✅ BACKWARD COMPATIBLE: Get active subscription for an entity
 * 
 * NEW BEHAVIOR: For USER entity_type, ALWAYS returns user's own license (no company inheritance)
 * For COMPANY entity_type, returns organization subscription info (for admin dashboard only)
 * 
 * @param {Object} entity - { entity_type: 'USER'|'COMPANY', entity_id: ObjectId }
 * @returns {Promise<Object>} Subscription details with license_code
 */
export const getActiveSubscription = async (entity) => {
  try {
    const { entity_type, entity_id } = entity;

    // ✅ USER: Always return user's OWN license (no company inheritance)
    if (entity_type === 'USER') {
      return getUserLicense(entity_id);
    }

    // COMPANY: Return organization-level subscription info (for pool management only)
    if (entity_type === 'COMPANY') {
      // This is ONLY for admin dashboard / pool management
      // NOT for limit enforcement (limits are always per-user)
      const subscription = await OrganizationSubscription.findOne({
        organization_id: entity_id,
      }).sort({ created_at: -1 });

      if (!subscription) {
        return {
          license_code: null, // Company has NO license
          status: 'NO_SUBSCRIPTION',
          entity_type: 'COMPANY',
          entity_id: entity_id,
          expiry_date: null,
          message: 'Company license pool is empty. Purchase licenses to assign to users.',
        };
      }

      const now = new Date();
      let status = subscription.status;

      if (subscription.subscription_end_date && subscription.subscription_end_date < now) {
        status = 'EXPIRED';
      }

      return {
        license_code: subscription.license_code,
        status: status,
        entity_type: 'COMPANY',
        entity_id: entity_id,
        expiry_date: subscription.subscription_end_date || subscription.trial_end_date,
        trial_end_date: subscription.trial_end_date,
        subscription_start_date: subscription.subscription_start_date,
        subscription_end_date: subscription.subscription_end_date,
      };
    }

    throw new Error('Invalid entity_type. Must be USER or COMPANY');
  } catch (error) {
    console.error('❌ Error getting active subscription:', error);
    throw error;
  }
};

/**
 * 1️⃣ CHECK FEATURE ACCESS (USER-LEVEL)
 * 
 * ✅ NEW: Always checks USER's own license (no company inheritance)
 * 
 * Access Check Logic:
 * 1. Get user's own license (from users.license_instance_id or license_code)
 * 2. If expired → BLOCK
 * 3. Check license_features for feature_code
 * 4. If exists → ALLOW
 * 5. Else → BLOCK
 * 
 * @param {Object|String} entityOrUserId - Either { entity_type: 'USER', entity_id: ObjectId } or just userId
 * @param {String} feature_code - Feature code to check (e.g., 'TASK_BASIC')
 * @returns {Promise<Object>} { hasAccess: boolean, reason: string, subscription: Object }
 */
export const checkFeatureAccess = async (entityOrUserId, feature_code) => {
  try {
    // ✅ NEW: Accept both entity object or direct userId
    let userId;
    let entity;

    if (typeof entityOrUserId === 'object' && entityOrUserId.entity_type) {
      entity = entityOrUserId;
      // For USER entity type, use entity_id directly
      // For COMPANY entity type, we need to find the requesting user
      if (entity.entity_type === 'USER') {
        userId = entity.entity_id;
      } else {
        // ⚠️ COMPANY entity type is deprecated for limit checks
        // This should only be used for pool management, not feature access
        console.warn('⚠️ [LICENSE SERVICE] COMPANY entity type used for feature access. This should use USER entity.');
        // Fall back to old behavior for backward compatibility
        entity = { entity_type: 'COMPANY', entity_id: entity.entity_id };
      }
    } else {
      userId = entityOrUserId;
      entity = { entity_type: 'USER', entity_id: userId };
    }

    console.log(`\n🔐 [LICENSE SERVICE] checkFeatureAccess - User: ${userId}, Feature: ${feature_code}`);

    // Step 1: Get user's own license (ALWAYS user-level)
    const subscription = userId
      ? await getUserLicense(userId)
      : await getActiveSubscription(entity);

    console.log('🔐 [LICENSE SERVICE] User License:', subscription);

    // Step 2: Only block suspended/cancelled — NEVER block based on expiry alone.
    // Expired licenses still show which features are in the plan (UI shows renewal banner).
    if (subscription.status === 'SUSPENDED' || subscription.status === 'CANCELLED') {
      return {
        hasAccess: false,
        reason: 'SUBSCRIPTION_INACTIVE',
        message: `Your subscription is ${subscription.status.toLowerCase()}. Please contact support.`,
        subscription: subscription,
        showUpgradeModal: true,
      };
    }

    // Step 3: No license code at all → BLOCK everything
    if (!subscription.license_code) {
      return {
        hasAccess: false,
        reason: 'NO_LICENSE',
        message: 'No license assigned. Please contact your admin.',
        subscription: subscription,
        showUpgradeModal: true,
      };
    }

    // Step 4: Check whether this feature exists in the plan (regardless of expiry)
    const featureMapping = await LicenseFeatureMapping.findOne({
      license_code: subscription.license_code,
      feature_code: feature_code,
      is_enabled: true,
    });

    console.log('🔐 [LICENSE SERVICE] Feature Mapping:', featureMapping);

    // Step 5: Feature NOT in plan → show upgrade message
    if (!featureMapping) {
      return {
        hasAccess: false,
        reason: 'FEATURE_NOT_IN_LICENSE',
        message: `${getFeatureDisplayName(feature_code)} is not available in your current plan.`,
        subscription: subscription,
        currentLicense: subscription.license_code,
        upgradeRequired: true,
        showUpgradeModal: true,
      };
    }

    // Feature IS in plan → allow (isExpired flag lets UI show a renewal banner)
    return {
      hasAccess: true,
      reason: subscription.is_expired ? 'PLAN_FEATURE_EXPIRED' : 'ACCESS_GRANTED',
      isExpired: subscription.is_expired || false,
      subscription: subscription,
      featureMapping: featureMapping,
      usageLimit: featureMapping.usage_limit,
      limitType: featureMapping.limit_type,
      isUnlimited: featureMapping.usage_limit === -1,
    };
  } catch (error) {
    console.error('❌ [LICENSE SERVICE] Error in checkFeatureAccess:', error);
    throw error;
  }
};

/**
 * 2️⃣ CHECK FEATURE LIMIT (USER-LEVEL)
 * 
 * ✅ NEW: Limits are ALWAYS per-user, never pooled across company
 * 
 * Limit Check Logic:
 * 1. Get user's license_features row
 * 2. If limit_value = NULL or -1 → ALLOW (unlimited)
 * 3. Get usage for current period (USER-LEVEL ONLY)
 * 4. If used_count + 1 > limit → BLOCK
 * 5. Else → ALLOW
 * 
 * @param {Object|String} entityOrUserId - Either { entity_type: 'USER', entity_id: ObjectId } or just userId
 * @param {String} feature_code - Feature code to check
 * @returns {Promise<Object>} { canConsume: boolean, usage: Object, limit: Number }
 */
export const checkFeatureLimit = async (entityOrUserId, feature_code) => {
  try {
    // ✅ NEW: Normalize to userId for user-level checks
    let userId;

    if (typeof entityOrUserId === 'object' && entityOrUserId.entity_type) {
      if (entityOrUserId.entity_type === 'USER') {
        userId = entityOrUserId.entity_id;
      } else {
        // ⚠️ For COMPANY type, we cannot check limits - they're per-user
        console.warn('⚠️ [LICENSE SERVICE] COMPANY entity type is not valid for limit checks. Limits are per-user.');
        return {
          canConsume: false,
          reason: 'INVALID_ENTITY',
          message: 'Feature limits must be checked per-user, not per-company.',
          hasAccess: false,
        };
      }
    } else {
      userId = entityOrUserId;
    }

    console.log(`\n📊 [LICENSE SERVICE] checkFeatureLimit - User: ${userId}, Feature: ${feature_code}`);

    // First check access (using user-level)
    const accessCheck = await checkFeatureAccess(userId, feature_code);

    if (!accessCheck.hasAccess) {
      return {
        canConsume: false,
        reason: accessCheck.reason,
        message: accessCheck.message,
        hasAccess: false,
      };
    }

    // Step 1 & 2: Check if unlimited
    if (accessCheck.isUnlimited) {
      console.log('📊 [LICENSE SERVICE] Feature is unlimited');
      // ✅ Still track usage for unlimited features (for analytics/reporting)
      const currentUsage = await UserFeatureUsage.getCurrentUsage(userId, feature_code, 'TOTAL');
      return {
        canConsume: true,
        reason: 'UNLIMITED',
        hasAccess: true,
        isUnlimited: true,
        usage: { used: currentUsage, limit: -1, remaining: -1 },
      };
    }

    // Step 3: Get usage for current period using UserFeatureUsage (USER-LEVEL)
    const limitType = accessCheck.limitType || 'MONTHLY';

    // ✅ NEW: Use UserFeatureUsage model with period_key
    const currentUsage = await UserFeatureUsage.getCurrentUsage(userId, feature_code, limitType);
    const limit = accessCheck.usageLimit;

    console.log('📊 [LICENSE SERVICE] Current usage:', currentUsage, 'Limit:', limit, 'LimitType:', limitType);

    // Step 4: Check if limit exceeded
    if (currentUsage >= limit) {
      const limitLabel = limitType === 'TOTAL' ? '' : ` for this ${limitType.toLowerCase()}`;
      return {
        canConsume: false,
        reason: 'LIMIT_EXCEEDED',
        message: `You've reached your ${getFeatureDisplayName(feature_code)} limit (${currentUsage}/${limit})${limitLabel}. Please upgrade your plan to continue.`,
        hasAccess: true,
        usage: {
          used: currentUsage,
          limit: limit,
          remaining: 0,
          percentage: 100,
        },
        limitType: limitType,
        upgradeRequired: true,
        showUpgradeModal: true,
      };
    }

    // Step 5: Limit not exceeded → ALLOW
    const remaining = limit - currentUsage;
    const percentage = (currentUsage / limit) * 100;

    return {
      canConsume: true,
      reason: 'LIMIT_AVAILABLE',
      hasAccess: true,
      usage: {
        used: currentUsage,
        limit: limit,
        remaining: remaining,
        percentage: Math.round(percentage),
      },
      limitType: limitType,
    };
  } catch (error) {
    console.error('❌ [LICENSE SERVICE] Error in checkFeatureLimit:', error);
    throw error;
  }
};

/**
 * 3️⃣ CONSUME FEATURE (USER-LEVEL)
 * 
 * ✅ NEW: Usage is ALWAYS tracked per-user
 * 
 * Every time something is created: consumeFeature(userId, "TASK_BASIC", 1)
 * 
 * This:
 * - Creates usage row if missing (USER-LEVEL)
 * - Increments count for the specific user
 * - Is wrapped in DB transaction
 * 
 * @param {Object|String} entityOrUserId - Either { entity_type: 'USER', entity_id: ObjectId } or just userId
 * @param {String} feature_code - Feature code
 * @param {Number} amount - Amount to consume (default: 1)
 * @returns {Promise<Object>} { success: boolean, usage: Object }
 */
export const consumeFeature = async (entityOrUserId, feature_code, amount = 1) => {
  console.log(`\n📊 [LICENSE SERVICE] ======= consumeFeature START =======`);
  console.log(`📊 [LICENSE SERVICE] Input: entityOrUserId=${JSON.stringify(entityOrUserId)}, feature_code=${feature_code}, amount=${amount}`);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ✅ NEW: Normalize to userId for user-level tracking
    let userId;

    if (typeof entityOrUserId === 'object' && entityOrUserId.entity_type) {
      if (entityOrUserId.entity_type === 'USER') {
        userId = entityOrUserId.entity_id;
      } else {
        // ⚠️ COMPANY type is not valid for consumption - usage is per-user
        console.error('❌ [LICENSE SERVICE] COMPANY entity type is not valid for consumeFeature. Usage must be per-user.');
        await session.abortTransaction();
        session.endSession();
        return {
          success: false,
          reason: 'INVALID_ENTITY',
          message: 'Feature consumption must be tracked per-user, not per-company.',
        };
      }
    } else {
      userId = entityOrUserId;
    }

    console.log(`✅ [LICENSE SERVICE] consumeFeature - User: ${userId}, Feature: ${feature_code}, Amount: ${amount}`);

    // Check if consumption is allowed (user-level)
    const limitCheck = await checkFeatureLimit(userId, feature_code);

    if (!limitCheck.canConsume) {
      await session.abortTransaction();
      session.endSession();

      return {
        success: false,
        reason: limitCheck.reason,
        message: limitCheck.message,
        usage: limitCheck.usage,
      };
    }

    // ✅ Track usage for unlimited features too (but never block them)
    const isUnlimited = limitCheck.isUnlimited;
    if (isUnlimited) {
      console.log('📊 [LICENSE SERVICE] Feature is UNLIMITED - tracking usage but never blocking');
    }

    // Get user's license for feature mapping
    const userLicense = await getUserLicense(userId);
    const featureMapping = await LicenseFeatureMapping.findOne({
      license_code: userLicense.license_code,
      feature_code: feature_code,
      is_enabled: true,
    });

    if (!featureMapping) {
      await session.abortTransaction();
      session.endSession();

      return {
        success: false,
        reason: 'FEATURE_NOT_FOUND',
        message: 'Feature configuration not found',
      };
    }

    const limitType = featureMapping.limit_type || 'MONTHLY';
    console.log(`📊 [LICENSE SERVICE] Feature ${feature_code} - limitType: ${limitType}, isUnlimited: ${isUnlimited}`);

    // ✅ NEW: Use UserFeatureUsage model (independent of LicenseInstance)
    // This tracks usage per user + feature + period_key
    const usageRecord = await UserFeatureUsage.consumeUsage(
      userId,
      feature_code,
      limitType,
      amount,
      session
    );

    console.log(`📊 [LICENSE SERVICE] UserFeatureUsage updated - periodKey: ${usageRecord.period_key}, used: ${usageRecord.used_count}`);

    // ✅ BACKWARD COMPATIBILITY: Also update FeatureUsageTracking (legacy model)
    // ✅ IMPORTANT: Legacy model uses 'TOTAL' for both TOTAL and NONE limit types
    const legacyLimitType = (limitType === 'NONE') ? 'TOTAL' : limitType;
    const { start, end } = FeatureUsageTracking.getCurrentPeriod(legacyLimitType);
    const legacyQuery = {
      feature_code: feature_code,
      period_start: start,
      usage_period: legacyLimitType,
      user_id: userId,
    };

    let legacyTracking = await FeatureUsageTracking.findOne(legacyQuery).session(session);

    if (!legacyTracking) {
      const createData = {
        ...legacyQuery,
        period_end: end,
        usage_count: 0,
        usage_limit: featureMapping.usage_limit,
      };
      legacyTracking = await FeatureUsageTracking.create([createData], { session });
      legacyTracking = legacyTracking[0];
    }

    legacyTracking.usage_count += amount;
    legacyTracking.last_used_at = new Date();
    await legacyTracking.save({ session });

    await session.commitTransaction();
    session.endSession();

    const usageLimit = featureMapping.usage_limit;
    console.log('✅ [LICENSE SERVICE] Feature consumed successfully. New usage:', usageRecord.used_count);

    return {
      success: true,
      reason: 'CONSUMED',
      message: 'Feature usage recorded successfully',
      usage: {
        used: usageRecord.used_count,
        limit: usageLimit,
        remaining: usageLimit === -1 ? -1 : usageLimit - usageRecord.used_count,
        percentage: usageLimit === -1 || usageLimit === 0 ? 0 : Math.round((usageRecord.used_count / usageLimit) * 100),
        periodKey: usageRecord.period_key,
        limitType: limitType,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('❌ [LICENSE SERVICE] Error in consumeFeature:', error);
    throw error;
  }
};

/**
 * 3️⃣.5️⃣ DECREMENT FEATURE USAGE (USER-LEVEL)
 * 
 * ✅ NEW: Decrement usage when items are deleted/undone
 * 
 * This is used when:
 * - User deletes a task
 * - User undoes an action
 * - System cleanup removes items
 * 
 * @param {Object|String} entityOrUserId - Either { entity_type: 'USER', entity_id: ObjectId } or just userId
 * @param {String} feature_code - Feature code
 * @param {Number} amount - Amount to decrement (default: 1)
 * @returns {Promise<Object>} { success: boolean, usage: Object }
 */
export const decrementFeature = async (entityOrUserId, feature_code, amount = 1) => {
  console.log(`\n📊 [LICENSE SERVICE] ======= decrementFeature START =======`);
  console.log(`📊 [LICENSE SERVICE] Input: entityOrUserId=${JSON.stringify(entityOrUserId)}, feature_code=${feature_code}, amount=${amount}`);

  try {
    // Normalize to userId
    let userId;
    if (typeof entityOrUserId === 'object' && entityOrUserId.entity_type) {
      if (entityOrUserId.entity_type === 'USER') {
        userId = entityOrUserId.entity_id;
      } else {
        console.error('❌ [LICENSE SERVICE] COMPANY entity type is not valid for decrementFeature.');
        return {
          success: false,
          reason: 'INVALID_ENTITY',
          message: 'Feature decrement must be tracked per-user, not per-company.',
        };
      }
    } else {
      userId = entityOrUserId;
    }

    // Get user's license for feature mapping
    const userLicense = await getUserLicense(userId);
    const featureMapping = await LicenseFeatureMapping.findOne({
      license_code: userLicense.license_code,
      feature_code: feature_code,
      is_enabled: true,
    });

    const limitType = featureMapping?.limit_type || 'MONTHLY';
    const periodKey = UserFeatureUsage.getPeriodKey(limitType);

    // Find existing usage record
    const usageRecord = await UserFeatureUsage.findOne({
      user_id: userId,
      feature_code: feature_code.toUpperCase(),
      period_key: periodKey,
    });

    if (!usageRecord) {
      console.log('📊 [LICENSE SERVICE] No usage record found, nothing to decrement');
      return {
        success: true,
        reason: 'NO_USAGE',
        message: 'No usage record found',
        usage: { used: 0, limit: featureMapping?.usage_limit || -1, remaining: -1 },
      };
    }

    // Decrement usage (never go below 0)
    usageRecord.used_count = Math.max(0, usageRecord.used_count - amount);
    await usageRecord.save();

    // Also update legacy FeatureUsageTracking for backward compatibility
    const { start } = FeatureUsageTracking.getCurrentPeriod(limitType);
    const legacyTracking = await FeatureUsageTracking.findOne({
      feature_code: feature_code,
      period_start: start,
      usage_period: limitType,
      user_id: userId,
    });

    if (legacyTracking) {
      legacyTracking.usage_count = Math.max(0, legacyTracking.usage_count - amount);
      await legacyTracking.save();
    }

    const usageLimit = featureMapping?.usage_limit || -1;
    console.log('✅ [LICENSE SERVICE] Feature decremented. New usage:', usageRecord.used_count);

    return {
      success: true,
      reason: 'DECREMENTED',
      message: 'Feature usage decremented successfully',
      usage: {
        used: usageRecord.used_count,
        limit: usageLimit,
        remaining: usageLimit === -1 ? -1 : usageLimit - usageRecord.used_count,
        percentage: usageLimit === -1 || usageLimit === 0 ? 0 : Math.round((usageRecord.used_count / usageLimit) * 100),
      },
    };
  } catch (error) {
    console.error('❌ [LICENSE SERVICE] Error in decrementFeature:', error);
    throw error;
  }
};

/**
 * 4️⃣ GET LICENSE SUMMARY (USER-LEVEL)
 * 
 * ✅ NEW: Returns user's own license and usage information
 * 
 * Used by dashboards and frontend to display user's license status
 * 
 * @param {Object|String} entityOrUserId - Either { entity_type: 'USER', entity_id: ObjectId } or just userId
 * @returns {Promise<Object>} Complete license summary for the user
 */
export const getLicenseSummary = async (entityOrUserId) => {
  try {
    // ✅ NEW: Normalize to userId
    let userId;

    if (typeof entityOrUserId === 'object' && entityOrUserId.entity_type) {
      if (entityOrUserId.entity_type === 'USER') {
        userId = entityOrUserId.entity_id;
      } else {
        // For COMPANY, return company pool info (not individual limits)
        return getCompanyLicensePoolSummary(entityOrUserId.entity_id);
      }
    } else {
      userId = entityOrUserId;
    }

    console.log(`\n📋 [LICENSE SERVICE] getLicenseSummary - User: ${userId}`);

    // Get user's own license (personal only — no org fallback)
    const userLicense = await getUserLicense(userId);
    const user = await User.findById(userId);

    // Get license details
    const license = await License.findOne({
      license_code: userLicense.license_code,
      is_active: true
    });

    if (!license) {
      throw new Error('License configuration not found');
    }

    // Get all features for this license
    const featureMappings = await LicenseFeatureMapping.find({
      license_code: userLicense.license_code,
      is_enabled: true,
    }).lean();

    // ✅ NEW: Get usage data using UserFeatureUsage model (USER-LEVEL)
    const usageData = await UserFeatureUsage.getUserCurrentUsage(userId, featureMappings);

    // Fill in any missing features with 0 usage
    for (const mapping of featureMappings) {
      if (!usageData[mapping.feature_code]) {
        usageData[mapping.feature_code] = {
          used: 0,
          limit: mapping.usage_limit,
          remaining: mapping.usage_limit === -1 ? -1 : mapping.usage_limit,
          isUnlimited: mapping.usage_limit === -1,
          percentage: 0,
          limitType: mapping.limit_type,
        };
      }
    }

    // Get feature access status
    const featuresList = {};
    for (const mapping of featureMappings) {
      const allowed = await checkFeatureAccess(userId, mapping.feature_code);
      featuresList[mapping.feature_code] = allowed.hasAccess;
    }

    console.log('📋 [LICENSE SERVICE] User summary generated successfully');

    // ✅ FIX: Derive accountType dynamically - individual users don't have an organization
    const derivedAccountType = user?.organization_id ? 'company' : 'individual';

    return {
      license: userLicense.license_code,
      licenseName: license.name,
      status: userLicense.status,
      expiry: userLicense.expiry_date,
      isExpired: userLicense.is_expired,
      trialExpired: userLicense.license_code === 'EXPLORE' && userLicense.is_expired,
      entityType: 'USER',
      entityId: userId,
      userId: userId,
      accountType: derivedAccountType,
      usage: usageData,
      features: featuresList,
      licenseDetails: {
        price_monthly: license.price_monthly,
        price_yearly: license.price_yearly,
        max_users: license.max_users,
        billing_cycle: userLicense.billing_cycle || license.billing_cycle,
        renewal_date: userLicense.expiry_date,
        purchase_id: userLicense.purchase_id,
        assigned_date: userLicense.assigned_date,
        source: userLicense.source,
      },
      // ✅ NEW: User-specific info
      user: {
        id: userId,
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        role: user?.role,
        isPrimaryAdmin: user?.isPrimaryAdmin,
        organizationId: user?.organization_id,
      },
    };
  } catch (error) {
    console.error('❌ [LICENSE SERVICE] Error in getLicenseSummary:', error);
    throw error;
  }
};

/**
 * 5️⃣ GET COMPANY LICENSE POOL SUMMARY
 * 
 * ✅ NEW: Returns company's license inventory (pool) - NOT for limit enforcement
 * 
 * Used by Primary Org Admin to view/manage license pool
 * 
 * @param {ObjectId|String} organizationId - Organization ID
 * @returns {Promise<Object>} Company license pool summary
 */
export const getCompanyLicensePoolSummary = async (organizationId) => {
  try {
    console.log(`\n📋 [LICENSE SERVICE] getCompanyLicensePoolSummary - Org: ${organizationId}`);

    // Get license instances pool summary
    const poolSummary = await LicenseInstance.getPoolSummary(organizationId);

    // Get all users in the organization with their licenses
    const users = await User.find({ organization_id: organizationId })
      .populate('license_instance_id')
      .select('firstName lastName email role isPrimaryAdmin license_instance_id license_code assigned_license status');

    // Calculate user license distribution
    const userLicenseDistribution = {};
    for (const user of users) {
      const userLicense = await getUserLicense(user._id);
      const licenseCode = userLicense.license_code;

      if (!userLicenseDistribution[licenseCode]) {
        userLicenseDistribution[licenseCode] = {
          count: 0,
          users: [],
        };
      }

      userLicenseDistribution[licenseCode].count++;
      userLicenseDistribution[licenseCode].users.push({
        id: user._id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        role: user.role,
        isPrimaryAdmin: user.isPrimaryAdmin,
        licenseStatus: userLicense.status,
        expiryDate: userLicense.expiry_date,
      });
    }

    return {
      entityType: 'COMPANY',
      organizationId: organizationId,
      pool: poolSummary, // Available licenses in pool
      userCount: users.length,
      userLicenseDistribution: userLicenseDistribution,
      message: 'Company license pool summary. Limits are enforced per-user.',
    };
  } catch (error) {
    console.error('❌ [LICENSE SERVICE] Error in getCompanyLicensePoolSummary:', error);
    throw error;
  }
};

/**
 * 6️⃣ GET USER LICENSE INFO
 * 
 * ✅ NEW: Simple helper to get user's current license info
 * 
 * @param {ObjectId|String} userId - User ID
 * @returns {Promise<Object>} User's license info
 */
export const getUserLicenseInfo = async (userId) => {
  return getUserLicense(userId);
};

/**
 * 6️⃣B GET ORGANIZATION LICENSE INFO
 * 
 * ✅ NEW: Get organization's current subscription and license plan details
 * 
 * @param {ObjectId|String} organizationId - Organization ID
 * @returns {Promise<Object>} Organization's license and subscription info
 */
export const getOrganizationLicenseInfo = async (organizationId) => {
  try {
    console.log(`\n📋 [LICENSE SERVICE] getOrganizationLicenseInfo - Org: ${organizationId}`);

    // Get the organization's subscription
    const subscription = await OrganizationSubscription.findOne({
      organization_id: organizationId,
    }).lean();

    if (!subscription) {
      console.warn(`⚠️ [LICENSE SERVICE] No subscription found for organization ${organizationId}`);
      return {
        organizationId: organizationId,
        subscription: null,
        plan: null,
        status: 'NO_SUBSCRIPTION',
        message: 'Organization has no active subscription',
      };
    }

    // Get the license details for the subscription's license code
    const license = await License.findOne({
      license_code: subscription.license_code,
    }).lean();

    if (!license) {
      console.warn(`⚠️ [LICENSE SERVICE] License not found for code ${subscription.license_code}`);
      return {
        organizationId: organizationId,
        subscription: subscription,
        plan: null,
        status: subscription.status,
        message: 'License details not found',
      };
    }

    return {
      organizationId: organizationId,
      subscription: {
        license_code: subscription.license_code,
        status: subscription.status,
        trial_start_date: subscription.trial_start_date,
        trial_end_date: subscription.trial_end_date,
        subscription_start_date: subscription.subscription_start_date,
        subscription_end_date: subscription.subscription_end_date,
        auto_renew: subscription.auto_renew,
      },
      plan: {
        license_code: license.license_code,
        name: license.name,
        description: license.description,
        max_users: license.max_users,
        features_summary: license.features_summary,
        is_active: license.is_active,
      },
      status: subscription.status,
      message: 'Organization license info retrieved successfully',
    };
  } catch (error) {
    console.error('❌ [LICENSE SERVICE] Error in getOrganizationLicenseInfo:', error);
    throw error;
  }
};

/**
 * 7️⃣ CAN ASSIGN LICENSE
 * 
 * ✅ NEW: Check if admin can assign a license to a user
 * 
 * Rules:
 * - Only Primary Org Admin can assign licenses
 * - Must have available license in company pool
 * - Cannot assign if user is from different organization
 * - Secondary org_admin (isPrimaryAdmin === false) can assign licenses EXCEPT to themselves or Primary Admin
 * 
 * @param {ObjectId|String} adminUserId - Admin user ID
 * @param {ObjectId|String} targetUserId - Target user ID
 * @param {String} targetLicenseCode - License code to assign
 * @returns {Promise<Object>} { canAssign: boolean, reason: string }
 */
export const canAssignLicense = async (adminUserId, targetUserId, targetLicenseCode) => {
  try {
    console.log(`\n🔑 [LICENSE SERVICE] canAssignLicense - Admin: ${adminUserId}, Target: ${targetUserId}, License: ${targetLicenseCode}`);

    // Get admin user
    const adminUser = await User.findById(adminUserId);
    if (!adminUser) {
      return { canAssign: false, reason: 'ADMIN_NOT_FOUND', message: 'Admin user not found' };
    }

    // Get target user first (needed for all checks)
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return { canAssign: false, reason: 'USER_NOT_FOUND', message: 'Target user not found' };
    }

    // Check if admin has permission to assign licenses
    const isSuperAdmin = adminUser.role?.includes('super_admin');
    const isPrimaryAdmin = adminUser.isPrimaryAdmin;
    const isOrgAdmin = adminUser.role?.includes('org_admin');

    // ✅ NEW: Secondary org_admin (isPrimaryAdmin === false) CAN assign licenses with restrictions
    if (!isSuperAdmin && !isPrimaryAdmin && !isOrgAdmin) {
      return {
        canAssign: false,
        reason: 'NOT_AUTHORIZED',
        message: 'Only Org Admin, Primary Admin, or Super Admin can assign licenses'
      };
    }

    // ✅ NEW: Secondary org_admin restrictions
    if (isOrgAdmin && !isPrimaryAdmin && !isSuperAdmin) {
      // Cannot assign to themselves
      if (adminUserId.toString() === targetUserId.toString()) {
        return {
          canAssign: false,
          reason: 'CANNOT_ASSIGN_SELF',
          message: 'You cannot assign a license to yourself. Contact the Primary Admin.'
        };
      }

      // Cannot assign to Primary Admin
      if (targetUser.isPrimaryAdmin) {
        return {
          canAssign: false,
          reason: 'CANNOT_ASSIGN_PRIMARY_ADMIN',
          message: 'You cannot assign a license to the Primary Admin'
        };
      }

      console.log(`📋 [LICENSE SERVICE] Secondary org_admin ${adminUserId} assigning license to ${targetUserId}`);
    }

    // Check same organization (unless super admin)
    if (!isSuperAdmin) {
      const adminOrgId = adminUser.organization_id?.toString();
      const targetOrgId = targetUser.organization_id?.toString();

      if (adminOrgId !== targetOrgId) {
        return {
          canAssign: false,
          reason: 'DIFFERENT_ORGANIZATION',
          message: 'Cannot assign license to user from different organization'
        };
      }

      // Check if license is available in pool
      const availableCount = await LicenseInstance.countAvailable(adminOrgId, targetLicenseCode);

      // If user already has this license type, they don't need a new one from pool
      const currentLicense = await getUserLicense(targetUserId);
      if (currentLicense.license_code === targetLicenseCode) {
        return {
          canAssign: true,
          reason: 'ALREADY_ASSIGNED',
          message: 'User already has this license'
        };
      }

      if (availableCount <= 0) {
        return {
          canAssign: false,
          reason: 'NO_AVAILABLE_LICENSE',
          message: `No available ${targetLicenseCode} licenses in company pool`
        };
      }
    }

    return {
      canAssign: true,
      reason: 'CAN_ASSIGN',
      message: `Can assign ${targetLicenseCode} license to user`
    };
  } catch (error) {
    console.error('❌ [LICENSE SERVICE] Error in canAssignLicense:', error);
    throw error;
  }
};

/**
 * 8️⃣ ASSIGN LICENSE TO USER
 * 
 * ✅ UPDATED: Assign a license from company pool to a user
 * ✅ VALIDATES: Downgrade is only allowed if usage fits new limits
 * 
 * Rules:
 * - Only Primary Org Admin can assign
 * - Pulls from company license pool
 * - Upgrade: Always allowed (usage carries forward)
 * - Downgrade: Validated against usage (blocked if usage > target limits)
 * - Updates user.license_instance_id
 * 
 * @param {ObjectId|String} adminUserId - Admin user ID
 * @param {ObjectId|String} targetUserId - Target user ID
 * @param {String} licenseCode - License code to assign
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
export const assignLicenseToUser = async (adminUserId, targetUserId, licenseCode) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`\n🔑 [LICENSE SERVICE] assignLicenseToUser - Admin: ${adminUserId}, Target: ${targetUserId}, License: ${licenseCode}`);

    // Check if assignment is allowed
    const canAssign = await canAssignLicense(adminUserId, targetUserId, licenseCode);
    if (!canAssign.canAssign && canAssign.reason !== 'ALREADY_ASSIGNED') {
      await session.abortTransaction();
      session.endSession();
      return { success: false, reason: canAssign.reason, message: canAssign.message };
    }

    // If already assigned same license, return success
    if (canAssign.reason === 'ALREADY_ASSIGNED') {
      await session.abortTransaction();
      session.endSession();
      return { success: true, reason: 'ALREADY_ASSIGNED', message: canAssign.message };
    }

    // Get admin and target user
    const adminUser = await User.findById(adminUserId).session(session);
    const targetUser = await User.findById(targetUserId).session(session);
    const organizationId = adminUser.organization_id;

    // ✅ Get current license for upgrade/downgrade validation
    const currentLicense = await getUserLicense(targetUserId);
    const currentLicenseCode = currentLicense.license_code || 'EXPLORE';

    // ✅ VALIDATE LICENSE CHANGE (upgrade allowed, downgrade validated)
    const validation = await validateLicenseChange(targetUserId, currentLicenseCode, licenseCode);

    if (!validation.allowed) {
      await session.abortTransaction();
      session.endSession();
      console.log(`❌ [LICENSE SERVICE] License change blocked:`, validation);
      return {
        success: false,
        reason: 'DOWNGRADE_NOT_ALLOWED',
        message: validation.message,
        violations: validation.violations,
        isDowngrade: true,
      };
    }

    console.log(`✅ [LICENSE SERVICE] License change validated - isUpgrade: ${validation.isUpgrade}, isDowngrade: ${validation.isDowngrade}`);

    // Release current license if exists (returns to pool)
    if (targetUser.license_instance_id) {
      const currentInstance = await LicenseInstance.findById(targetUser.license_instance_id).session(session);
      if (currentInstance) {
        await currentInstance.releaseFromUser();
        console.log(`✅ [LICENSE SERVICE] Released old license instance back to pool`);
      }
    }

    // ✅ IMPORTANT: Usage is NOT reset on upgrade/downgrade
    // Usage stays the same - only the ceiling (limits) changes

    // Find and assign new license from pool
    const licenseInstance = await LicenseInstance.findAvailableInstance(organizationId, licenseCode);

    if (!licenseInstance) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        reason: 'NO_AVAILABLE_LICENSE',
        message: `No available ${licenseCode} license in pool`
      };
    }

    // Assign license instance to user
    console.log(`\n🔄 ========== ASSIGNING LICENSE TO USER ==========`);
    console.log(`👤 Target User ID: ${targetUserId}`);
    console.log(`📦 License Code: ${licenseCode}`);
    console.log(`🎫 License Instance ID: ${licenseInstance._id}`);

    await licenseInstance.assignToUser(targetUserId);
    console.log(`✅ License instance assigned to user`);

    // ✅ SINGLE SOURCE OF TRUTH: Fetch license definition for duration
    const licenseDef = await License.findOne({ license_code: licenseCode }).session(session);

    // Calculate expiry date
    const now = new Date();
    const expiryDate = new Date(now);
    let daysToAdd = 30; // Default fallback

    if (licenseDef && licenseDef.billing_cycle === 'TRIAL') {
      daysToAdd = licenseDef.trial_days;
      console.log(`ℹ️ [LICENSE SERVICE] Using trial duration from license definition: ${daysToAdd} days`);
    } else {
      // Check subscription billing cycle for paid licenses
      const subscription = await OrganizationSubscription.findOne({ organization_id: organizationId }).session(session);
      const billingCycle = subscription?.billing_cycle || 'MONTHLY';
      daysToAdd = billingCycle === 'YEARLY' ? 365 : 30;
      console.log(`ℹ️ [LICENSE SERVICE] Using ${billingCycle} duration: ${daysToAdd} days`);
    }

    expiryDate.setDate(expiryDate.getDate() + daysToAdd);

    console.log(`⏰ Current Date: ${now.toISOString()}`);
    console.log(`📊 Days to Add: ${daysToAdd}`);
    console.log(`📅 Calculated Expiry Date: ${expiryDate.toISOString()}`);

    // Update user's license_instance_id and expiry date
    console.log(`\n💾 Updating User document with:`);
    console.log(`   - license_instance_id: ${licenseInstance._id}`);
    console.log(`   - license_code: ${licenseCode}`);
    console.log(`   - license_expiry: ${expiryDate.toISOString()}`);
    console.log(`   - subscription_end_date: ${expiryDate.toISOString()}`);

    await User.findByIdAndUpdate(targetUserId, {
      license_instance_id: licenseInstance._id,
      license_code: licenseCode, // Also update legacy field for compatibility
      license_expiry: expiryDate,
      subscription_end_date: expiryDate,
    }, { session });

    console.log(`✅ [LICENSE SERVICE] User document updated successfully`);
    console.log(`   - Expiry: ${expiryDate.toISOString()}`);
    console.log(`   - Days from now: ${daysToAdd}`);
    console.log(`================================================\n`);

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ [LICENSE SERVICE] License ${licenseCode} assigned to user ${targetUserId} (${validation.isUpgrade ? 'UPGRADE' : validation.isDowngrade ? 'DOWNGRADE' : 'CHANGE'})`);

    return {
      success: true,
      reason: 'ASSIGNED',
      message: `${licenseCode} license assigned successfully`,
      isUpgrade: validation.isUpgrade,
      isDowngrade: validation.isDowngrade,
      previousLicense: currentLicenseCode,
      licenseInstance: {
        id: licenseInstance._id,
        license_code: licenseCode,
        assigned_at: licenseInstance.assigned_at,
        renewal_date: licenseInstance.renewal_date,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ [LICENSE SERVICE] Error in assignLicenseToUser:', error);
    throw error;
  }
};

/**
 * 9️⃣ UNASSIGN LICENSE FROM USER
 * 
 * ✅ NEW: Release user's license back to company pool
 * ✅ UPDATED: Secondary org_admin (isPrimaryAdmin === false) can also unassign, with restrictions
 * 
 * @param {ObjectId|String} adminUserId - Admin user ID
 * @param {ObjectId|String} targetUserId - Target user ID
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
export const unassignLicenseFromUser = async (adminUserId, targetUserId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`\n🔑 [LICENSE SERVICE] unassignLicenseFromUser - Admin: ${adminUserId}, Target: ${targetUserId}`);

    // Get admin user
    const adminUser = await User.findById(adminUserId);
    if (!adminUser) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, reason: 'ADMIN_NOT_FOUND', message: 'Admin user not found' };
    }

    // Get target user (needed for all checks)
    const targetUser = await User.findById(targetUserId).session(session);
    if (!targetUser) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, reason: 'USER_NOT_FOUND', message: 'Target user not found' };
    }

    // Check if admin has permission
    const isSuperAdmin = adminUser.role?.includes('super_admin');
    const isPrimaryAdmin = adminUser.isPrimaryAdmin;
    const isOrgAdmin = adminUser.role?.includes('org_admin');

    // ✅ NEW: org_admin (even secondary) can unassign licenses with restrictions
    if (!isSuperAdmin && !isPrimaryAdmin && !isOrgAdmin) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        reason: 'NOT_AUTHORIZED',
        message: 'Only Org Admin, Primary Admin, or Super Admin can unassign licenses'
      };
    }

    // ✅ NEW: Secondary org_admin restrictions
    if (isOrgAdmin && !isPrimaryAdmin && !isSuperAdmin) {
      // Cannot unassign from themselves
      if (adminUserId.toString() === targetUserId.toString()) {
        await session.abortTransaction();
        session.endSession();
        return {
          success: false,
          reason: 'CANNOT_UNASSIGN_SELF',
          message: 'You cannot unassign your own license. Contact the Primary Admin.'
        };
      }

      // Cannot unassign from Primary Admin
      if (targetUser.isPrimaryAdmin) {
        await session.abortTransaction();
        session.endSession();
        return {
          success: false,
          reason: 'CANNOT_UNASSIGN_PRIMARY_ADMIN',
          message: 'You cannot unassign the Primary Admin\'s license'
        };
      }

      console.log(`📋 [LICENSE SERVICE] Secondary org_admin ${adminUserId} unassigning license from ${targetUserId}`);
    }

    // Release current license
    if (targetUser.license_instance_id) {
      const currentInstance = await LicenseInstance.findById(targetUser.license_instance_id).session(session);
      if (currentInstance) {
        await currentInstance.releaseFromUser();
      }
    }

    // Clear user's license fields (they'll default to EXPLORE)
    await User.findByIdAndUpdate(targetUserId, {
      license_instance_id: null,
      license_code: null,
      assigned_license: null,
    }, { session });

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ [LICENSE SERVICE] License unassigned from user ${targetUserId}`);

    return {
      success: true,
      reason: 'UNASSIGNED',
      message: 'License released back to pool. User now has EXPLORE (trial) license.',
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ [LICENSE SERVICE] Error in unassignLicenseFromUser:', error);
    throw error;
  }
};

/**
 * 🔟 CHECK DOWNGRADE ELIGIBILITY
 * 
 * ✅ AUTHORITATIVE RULE: Downgrade is allowed ONLY IF current usage ≤ target license limits
 * for ALL enabled features
 * 
 * Key Principles:
 * - Usage is FEATURE-based, independent of LicenseInstance
 * - Downgrade NEVER resets usage
 * - Downgrade is VALIDATED, not forced
 * 
 * @param {ObjectId|String} userId - User ID
 * @param {String} targetLicenseCode - Target license code
 * @returns {Promise<Object>} { canDowngrade: boolean, violations: Array }
 */
export const checkDowngradeEligibility = async (userId, targetLicenseCode) => {
  try {
    console.log(`\n📉 [LICENSE SERVICE] checkDowngradeEligibility - User: ${userId}, Target: ${targetLicenseCode}`);

    // Get target license feature mappings
    const targetMappings = await LicenseFeatureMapping.find({
      license_code: targetLicenseCode.toUpperCase(),
      is_enabled: true,
    }).lean();

    if (!targetMappings || targetMappings.length === 0) {
      return {
        canDowngrade: false,
        reason: 'INVALID_LICENSE',
        message: `No feature mappings found for license: ${targetLicenseCode}`,
        violations: [],
      };
    }

    // ✅ Use UserFeatureUsage model for validation
    const validationResult = await UserFeatureUsage.validateDowngrade(userId, targetMappings);

    if (!validationResult.allowed) {
      console.log(`❌ [LICENSE SERVICE] Downgrade blocked. Violations:`, validationResult.violations);
      return {
        canDowngrade: false,
        reason: 'USAGE_EXCEEDS_LIMIT',
        message: 'Current usage exceeds target license limits',
        violations: validationResult.violations,
      };
    }

    console.log(`✅ [LICENSE SERVICE] Downgrade allowed to ${targetLicenseCode}`);
    return {
      canDowngrade: true,
      reason: 'ELIGIBLE',
      message: 'User can be downgraded to target license',
      violations: [],
    };
  } catch (error) {
    console.error('❌ [LICENSE SERVICE] Error in checkDowngradeEligibility:', error);
    throw error;
  }
};

/**
 * 1️⃣1️⃣ VALIDATE LICENSE CHANGE (UPGRADE OR DOWNGRADE)
 * 
 * ✅ CORE LOGIC:
 * - Upgrade: Always allowed (no usage reset)
 * - Downgrade: Only allowed if current usage fits target license limits
 * 
 * @param {ObjectId|String} userId - User ID
 * @param {String} currentLicenseCode - Current license code
 * @param {String} targetLicenseCode - Target license code
 * @returns {Promise<Object>} { allowed: boolean, isUpgrade: boolean, isDowngrade: boolean, violations: Array }
 */
export const validateLicenseChange = async (userId, currentLicenseCode, targetLicenseCode) => {
  try {
    const current = currentLicenseCode?.toUpperCase() || 'EXPLORE';
    const target = targetLicenseCode?.toUpperCase();

    console.log(`\n🔄 [LICENSE SERVICE] validateLicenseChange - User: ${userId}, Current: ${current}, Target: ${target}`);

    // Determine if upgrade or downgrade based on license hierarchy
    const currentIndex = LICENSE_HIERARCHY.indexOf(current);
    const targetIndex = LICENSE_HIERARCHY.indexOf(target);

    const isSame = current === target;
    const isUpgrade = targetIndex > currentIndex;
    const isDowngrade = targetIndex < currentIndex;

    // Same license - no validation needed
    if (isSame) {
      return {
        allowed: true,
        isUpgrade: false,
        isDowngrade: false,
        isSame: true,
        message: 'Same license - no change needed',
        violations: [],
      };
    }

    // ✅ UPGRADE: Always allowed (usage carries forward, ceiling changes)
    if (isUpgrade) {
      console.log(`✅ [LICENSE SERVICE] Upgrade from ${current} to ${target} - ALLOWED`);
      return {
        allowed: true,
        isUpgrade: true,
        isDowngrade: false,
        isSame: false,
        message: `Upgrade from ${current} to ${target} allowed`,
        violations: [],
      };
    }

    // ✅ DOWNGRADE: Validate usage against target limits
    if (isDowngrade) {
      console.log(`📉 [LICENSE SERVICE] Downgrade from ${current} to ${target} - validating...`);
      const result = await checkDowngradeEligibility(userId, target);

      return {
        allowed: result.canDowngrade,
        isUpgrade: false,
        isDowngrade: true,
        isSame: false,
        message: result.message,
        violations: result.violations || [],
      };
    }

    // Fallback (shouldn't reach here)
    return {
      allowed: true,
      isUpgrade: false,
      isDowngrade: false,
      isSame: false,
      message: 'License change validation passed',
      violations: [],
    };
  } catch (error) {
    console.error('❌ [LICENSE SERVICE] Error in validateLicenseChange:', error);
    throw error;
  }
};
