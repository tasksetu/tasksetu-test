import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';
import { LicenseFeatureMapping } from '../modals/licenseFeatureMappingModal.js';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import * as licenseService from '../services/licenseService.js';

/**
 * Get effective license for a user
 * 
 * ✅ UPDATED v2: Always returns USER's own license (no company inheritance)
 * 
 * Every user has their OWN license - no automatic inheritance from company
 */
export const getEffectiveLicense = async (userId, organizationId) => {
  try {
    // 🆕 Check for pending license activation BEFORE getting license info
    // This auto-activates scheduled downgrades when the current plan expires
    try {
      const user = await User.findById(userId);
      if (user?.pending_license?.license_code && user?.pending_license?.scheduled_start_date) {
        const now = new Date();
        const scheduledStart = new Date(user.pending_license.scheduled_start_date);

        // Activate pending license if scheduled start date has arrived
        if (now >= scheduledStart) {
          console.log(`🔄 Auto-activating pending license for user ${userId}: ${user.pending_license.license_code}`);

          if (user.license_instance_id) {
            const { default: LicenseInstance } = await import('../modals/licenseInstanceModal.js');
            const currentInstance = await LicenseInstance.findById(user.license_instance_id);
            if (currentInstance) {
              await currentInstance.releaseFromUser();
            }
            user.license_instance_id = null;
          }

          user.license_code = user.pending_license.license_code;
          user.license_expiry = user.pending_license.scheduled_end_date;
          // Clear pending license
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
          console.log(`✅ Pending license activated: ${user.license_code} until ${user.license_expiry}`);
        }
      }
    } catch (pendingErr) {
      console.error('⚠️ Error checking pending license:', pendingErr.message);
      // Don't block the flow if pending license check fails
    }

    // ✅ NEW: Use licenseService.getUserLicenseInfo for consistent user-level license
    const userLicense = await licenseService.getUserLicenseInfo(userId);

    return {
      license_code: userLicense.license_code,
      source: userLicense.source,
      entity_id: userId,
      account_type: userLicense.account_type || 'company',
      status: userLicense.status,
      expiry_date: userLicense.expiry_date,
      is_expired: userLicense.is_expired,
      billing_cycle: userLicense.billing_cycle || 'MONTHLY',
    };
  } catch (error) {
    console.error('❌ Error getting effective license:', error);
    throw error;
  }
};

/**
 * Middleware to check if user has access to a specific feature
 * Enforces usage limits and license restrictions
 * 
 * ⚡ UPDATED v2: Now uses USER-LEVEL licensing (no company inheritance)
 * Each user is checked against their OWN license, not company's
 */
export const checkFeatureAccess = (featureCode) => {
  return async (req, res, next) => {
    try {
      console.log(`\n🔐 [LICENSE CHECK] Starting feature access check for: ${featureCode}`);

      const userId = req.user?.id || req.user?._id || req.user?.userId;

      console.log('🔐 [LICENSE CHECK] User ID:', userId);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'USER_REQUIRED',
        });
      }

      // ✅ NEW: Always use user-level checks (no company entity)
      // Step 1: Check Feature Access using licenseService (USER-LEVEL)
      const accessCheck = await licenseService.checkFeatureAccess(userId, featureCode);

      console.log('🔐 [LICENSE CHECK] Access Check Result:', accessCheck);

      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          success: false,
          message: accessCheck.message || `${licenseService.getFeatureDisplayName(featureCode)} is not available in your current plan`,
          error: accessCheck.reason,
          currentLicense: accessCheck.subscription?.license_code,
          upgradeRequired: accessCheck.upgradeRequired,
          showUpgradeModal: accessCheck.showUpgradeModal,
          trialExpired: accessCheck.trialExpired,
          feature: featureCode,
        });
      }

      // Step 2: Check Feature Limit using licenseService (USER-LEVEL)
      const limitCheck = await licenseService.checkFeatureLimit(userId, featureCode);

      console.log('🔐 [LICENSE CHECK] Limit Check Result:', limitCheck);

      if (!limitCheck.canConsume) {
        const featureDisplayName = licenseService.getFeatureDisplayName(featureCode);
        return res.status(429).json({
          success: false,
          message: limitCheck.message || `Usage limit exceeded for ${featureDisplayName}`,
          error: limitCheck.reason,
          usage: limitCheck.usage,
          limitType: limitCheck.limitType,
          currentLicense: accessCheck.subscription?.license_code,
          upgradePrompt: true,
          showUpgradeModal: limitCheck.showUpgradeModal,
          upgradeCTA: {
            title: `Upgrade to unlock more ${featureDisplayName}`,
            description: limitCheck.usage ? `You've used all ${limitCheck.usage.limit} ${featureDisplayName} this ${limitCheck.limitType?.toLowerCase()}` : '',
            action: 'VIEW_PLANS',
          },
        });
      }

      // ✅ NEW: Attach user-level usage info to request
      req.featureUsage = {
        feature_code: featureCode,
        user_id: userId,
        usage_info: limitCheck.usage,
        limit_type: limitCheck.limitType,
      };

      // Attach license and feature access to request
      req.licenseInfo = accessCheck.subscription;
      req.featureAccess = accessCheck;

      console.log('✅ [LICENSE CHECK] Access granted, proceeding to controller\n');
      next();
    } catch (error) {
      console.error('❌ Feature access check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking feature access',
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to track feature usage after successful operation
 * Should be called AFTER the operation completes
 * ⚡ UPDATED v2: Now uses USER-LEVEL tracking
 */
export const trackFeatureUsage = (featureCode, incrementAmount = 1) => {
  return async (req, res, next) => {
    try {
      // ✅ NEW: Use user_id for tracking
      const userId = req.featureUsage?.user_id || req.user?.id || req.user?._id || req.user?.userId;

      if (!userId) {
        console.log('⚠️ [TRACK USAGE] No user ID found, skipping');
        return next();
      }

      // Use licenseService to consume feature (USER-LEVEL)
      const result = await licenseService.consumeFeature(
        userId,
        featureCode,
        incrementAmount
      );

      console.log('✅ [TRACK USAGE] Feature consumed:', result);

      next();
    } catch (error) {
      console.error('⚠️ Feature usage tracking error:', error);
      // Don't block the request if tracking fails
      next();
    }
  };
};

/**
 * Middleware to check concurrent usage limits (for real-time features)
 * ✅ UPDATED v2: Uses user-level checks
 */
export const checkConcurrentLimit = (featureCode) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id || req.user?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
          error: 'USER_REQUIRED',
        });
      }

      // ✅ NEW: Get user's own license
      const licenseInfo = await getEffectiveLicense(userId);

      const featureAccess = await LicenseFeatureMapping.checkFeatureAccess(
        licenseInfo.license_code,
        featureCode
      );

      if (!featureAccess.hasAccess || featureAccess.limitType !== 'CONCURRENT') {
        return next();
      }

      const { start } = FeatureUsageTracking.getCurrentPeriod('CONCURRENT');

      // ✅ NEW: Always use user_id for concurrent tracking
      const query = {
        feature_code: featureCode,
        period_start: start,
        usage_period: 'CONCURRENT',
        user_id: userId,
      };

      let tracking = await FeatureUsageTracking.findOne(query);

      if (!tracking) {
        const createData = {
          feature_code: featureCode,
          usage_period: 'CONCURRENT',
          period_start: start,
          usage_limit: featureAccess.usageLimit,
          user_id: userId,
        };

        tracking = await FeatureUsageTracking.create(createData);
      }

      if (
        featureAccess.usageLimit !== -1 &&
        tracking.current_concurrent_usage >= featureAccess.usageLimit
      ) {
        return res.status(429).json({
          success: false,
          message: `Concurrent usage limit exceeded for ${featureCode}`,
          error: 'CONCURRENT_LIMIT_EXCEEDED',
          currentUsage: tracking.current_concurrent_usage,
          usageLimit: featureAccess.usageLimit,
          showUpgradeModal: true,
        });
      }

      await tracking.incrementConcurrent();
      req.concurrentTracking = tracking;
      req.licenseInfo = licenseInfo;

      next();
    } catch (error) {
      console.error('❌ Concurrent limit check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking concurrent limits',
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to release concurrent usage slot
 * Call this when operation ends (e.g., WebSocket disconnect)
 * ✅ UPDATED v2: Uses user_id only
 */
export const releaseConcurrentSlot = async (userId, featureCode) => {
  try {
    const { start } = FeatureUsageTracking.getCurrentPeriod('CONCURRENT');

    const query = {
      feature_code: featureCode,
      period_start: start,
      usage_period: 'CONCURRENT',
      user_id: userId,
    };

    const tracking = await FeatureUsageTracking.findOne(query);

    if (tracking) {
      await tracking.decrementConcurrent();
    }
  } catch (error) {
    console.error('⚠️ Error releasing concurrent slot:', error);
  }
};

/**
 * Middleware to check if organization has available user seats
 */
export const checkAvailableSeats = async (req, res, next) => {
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
      status: { $in: ['ACTIVE', 'TRIAL'] },
    });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: 'No active subscription',
        error: 'SUBSCRIPTION_REQUIRED',
      });
    }

    if (!subscription.hasAvailableSeats()) {
      return res.status(403).json({
        success: false,
        message: 'No available seats. Please upgrade your plan.',
        error: 'SEAT_LIMIT_EXCEEDED',
        seatsUsed: subscription.seats_used,
        seatsPurchased: subscription.seats_purchased,
        upgradeRequired: true,
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('❌ Seat check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking available seats',
      error: error.message,
    });
  }
};

/**
 * Dynamic Task Feature Check Middleware
 * 
 * ✅ Determines the correct feature code based on taskType in request body
 * Checks: TASK_BASIC (regular), TASK_RECUR (recurring), TASK_APPROVAL (approval), TASK_MSTONE (milestone)
 * 
 * Usage: checkDynamicTaskFeature() - No parameter needed, reads from req.body
 */
export const checkDynamicTaskFeature = () => {
  return async (req, res, next) => {
    try {
      console.log('\n🔐 [DYNAMIC TASK CHECK] Starting dynamic task feature check...');

      const userId = req.user?.id || req.user?._id || req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'USER_REQUIRED',
        });
      }

      // Determine task type from request body
      // Handle both JSON and form-data (multipart)
      let taskType = req.body?.taskType;
      let isRecurring = req.body?.isRecurring;
      let recurrencePattern = req.body?.recurrencePattern;

      // Parse stringified values if needed (multipart form-data)
      if (typeof isRecurring === 'string') {
        isRecurring = isRecurring === 'true';
      }
      if (typeof recurrencePattern === 'string' && recurrencePattern) {
        try {
          recurrencePattern = JSON.parse(recurrencePattern);
        } catch (e) {
          // Not valid JSON, keep as-is
        }
      }

      // Parse linkedTaskIds and milestoneData for PROC_CREATE check
      let linkedTaskIds = req.body?.linkedTaskIds;
      let milestoneData = req.body?.milestoneData;

      if (typeof linkedTaskIds === 'string' && linkedTaskIds) {
        try {
          linkedTaskIds = JSON.parse(linkedTaskIds);
        } catch (e) {
          // Not valid JSON
        }
      }
      if (typeof milestoneData === 'string' && milestoneData) {
        try {
          milestoneData = JSON.parse(milestoneData);
        } catch (e) {
          // Not valid JSON
        }
      }

      // Determine the feature code based on task type
      let featureCode = 'TASK_BASIC'; // Default for regular tasks
      let additionalFeatureToCheck = null; // Reserved for future use

      if (taskType === 'recurring' || isRecurring || recurrencePattern) {
        featureCode = 'TASK_RECUR';
      } else if (taskType === 'approval') {
        featureCode = 'TASK_APPROVAL';
      } else if (taskType === 'milestone') {
        // Check if milestone has linked tasks
        const hasLinkedTasks = (Array.isArray(linkedTaskIds) && linkedTaskIds.length > 0) ||
          (milestoneData?.linkedTaskIds && milestoneData.linkedTaskIds.length > 0);

        if (hasLinkedTasks) {
          // Milestone with linked tasks uses PROC_CREATE (process/workflow creation)
          featureCode = 'PROC_CREATE';
          console.log('🔐 [DYNAMIC TASK CHECK] Milestone with linked tasks - using PROC_CREATE');
        } else {
          // Milestone without linked tasks uses TASK_MSTONE
          featureCode = 'TASK_MSTONE';
          console.log('🔐 [DYNAMIC TASK CHECK] Milestone without linked tasks - using TASK_MSTONE');
        }
      }

      console.log('🔐 [DYNAMIC TASK CHECK] Detected task type:', taskType);
      console.log('🔐 [DYNAMIC TASK CHECK] Is Recurring:', isRecurring);
      console.log('🔐 [DYNAMIC TASK CHECK] Feature Code:', featureCode);
      if (additionalFeatureToCheck) {
        console.log('🔐 [DYNAMIC TASK CHECK] Additional Feature:', additionalFeatureToCheck);
      }

      // Check feature access for the determined feature code
      const accessCheck = await licenseService.checkFeatureAccess(userId, featureCode);

      console.log('🔐 [DYNAMIC TASK CHECK] Access Check Result:', accessCheck);

      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          success: false,
          message: accessCheck.message || `${licenseService.getFeatureDisplayName(featureCode)} is not available in your current plan`,
          error: accessCheck.reason,
          currentLicense: accessCheck.subscription?.license_code,
          upgradeRequired: accessCheck.upgradeRequired,
          showUpgradeModal: accessCheck.showUpgradeModal,
          trialExpired: accessCheck.trialExpired,
          feature: featureCode,
        });
      }

      // Check feature limit
      const limitCheck = await licenseService.checkFeatureLimit(userId, featureCode);

      console.log('🔐 [DYNAMIC TASK CHECK] Limit Check Result:', limitCheck);

      if (!limitCheck.canConsume) {
        const featureDisplayName = licenseService.getFeatureDisplayName(featureCode);
        return res.status(429).json({
          success: false,
          message: limitCheck.message || `Usage limit exceeded for ${featureDisplayName}`,
          error: limitCheck.reason,
          usage: limitCheck.usage,
          limitType: limitCheck.limitType,
          currentLicense: accessCheck.subscription?.license_code,
          upgradePrompt: true,
          showUpgradeModal: limitCheck.showUpgradeModal,
          upgradeCTA: {
            title: `Upgrade to unlock more ${featureDisplayName}`,
            description: limitCheck.usage ? `You've used all ${limitCheck.usage.limit} ${featureDisplayName} this ${limitCheck.limitType?.toLowerCase()}` : '',
            action: 'VIEW_PLANS',
          },
        });
      }

      // ✅ PROC_CREATE: Check additional feature for milestone with linked tasks
      if (additionalFeatureToCheck) {
        const procAccessCheck = await licenseService.checkFeatureAccess(userId, additionalFeatureToCheck);

        if (!procAccessCheck.hasAccess) {
          return res.status(403).json({
            success: false,
            message: `Process/Workflow creation (linking tasks) requires ${additionalFeatureToCheck} feature`,
            error: procAccessCheck.reason,
            upgradeRequired: true,
            showUpgradeModal: true,
            feature: additionalFeatureToCheck,
          });
        }

        const procLimitCheck = await licenseService.checkFeatureLimit(userId, additionalFeatureToCheck);

        if (!procLimitCheck.canConsume) {
          return res.status(429).json({
            success: false,
            message: procLimitCheck.message || `Process/Workflow limit exceeded`,
            error: procLimitCheck.reason,
            usage: procLimitCheck.usage,
            upgradePrompt: true,
            showUpgradeModal: true,
            feature: additionalFeatureToCheck,
          });
        }
      }

      // Attach feature info to request for controller to use
      req.featureUsage = {
        feature_code: featureCode,
        user_id: userId,
        usage_info: limitCheck.usage,
        limit_type: limitCheck.limitType,
        task_type: taskType,
        additional_feature: additionalFeatureToCheck, // ✅ For PROC_CREATE consumption
      };

      req.licenseInfo = accessCheck.subscription;
      req.featureAccess = accessCheck;

      console.log('✅ [DYNAMIC TASK CHECK] Access granted for', featureCode);
      if (additionalFeatureToCheck) {
        console.log('✅ [DYNAMIC TASK CHECK] Also consuming:', additionalFeatureToCheck);
      }
      console.log('');
      next();
    } catch (error) {
      console.error('❌ Dynamic task feature check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking feature access',
        error: error.message,
      });
    }
  };
};

/**
 * Helper function to get feature access summary for a user
 * Handles both individual and company accounts
 */
export const getFeatureAccessSummary = async (userId, organizationId) => {
  try {
    // Get effective license
    const licenseInfo = await getEffectiveLicense(userId, organizationId);

    const features = await LicenseFeatureMapping.getFeaturesByLicense(
      licenseInfo.license_code
    );

    const usageSummary = await FeatureUsageTracking.getEntityUsage(
      licenseInfo.entity_id,
      'MONTHLY',
      licenseInfo.account_type
    );

    const usageMap = {};
    usageSummary.forEach((usage) => {
      usageMap[usage.feature_code] = usage;
    });

    const featuresWithUsage = features.map((feature) => ({
      feature_code: feature.feature_code,
      is_enabled: feature.is_enabled,
      usage_limit: feature.usage_limit,
      limit_type: feature.limit_type,
      is_unlimited: feature.usage_limit === -1,
      current_usage: usageMap[feature.feature_code]?.usage_count || 0,
      remaining: usageMap[feature.feature_code]?.remaining || feature.usage_limit,
      percentage: usageMap[feature.feature_code]?.percentage || 0,
      is_limit_exceeded: usageMap[feature.feature_code]?.isLimitExceeded || false,
    }));

    return {
      hasSubscription: true,
      license_code: licenseInfo.license_code,
      account_type: licenseInfo.account_type,
      license_source: licenseInfo.source,
      entity_id: licenseInfo.entity_id,
      features: featuresWithUsage,
    };
  } catch (error) {
    console.error('❌ Error getting feature access summary:', error);
    throw error;
  }
};
