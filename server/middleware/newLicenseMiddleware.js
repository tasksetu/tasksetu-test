import { CompanyLicense } from '../modals/companyLicenseModal.js';
import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';
import { LicenseFeatureMapping } from '../modals/licenseFeatureMappingModal.js';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import { License } from '../modals/licenseModal.js';

/**
 * 🆕 NEW LICENSE ENFORCEMENT MIDDLEWARE
 * 
 * Core Rules:
 * 1. User must have license_id assigned
 * 2. License must be ACTIVE and not EXPIRED
 * 3. License type determines feature access
 * 4. Role ≠ License (separate concerns)
 */

/**
 * Get user's effective license from license_id
 * Returns null if no license assigned
 */
export const getUserEffectiveLicense = async (userId) => {
  try {
    const user = await User.findById(userId).populate('license_id');

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has license assigned
    if (!user.license_id) {
      return {
        has_license: false,
        license_type: null,
        license_id: null,
        message: 'No license assigned to user',
      };
    }

    const license = user.license_id;

    // Verify license is valid
    if (license.status !== 'ASSIGNED') {
      return {
        has_license: false,
        license_type: null,
        license_id: license._id,
        message: `License status is ${license.status}, not ASSIGNED`,
      };
    }

    // Check if license is expired
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return {
        has_license: false,
        license_type: license.license_type,
        license_id: license._id,
        message: 'License has expired',
        expired: true,
      };
    }

    // User has valid license
    return {
      has_license: true,
      license_type: license.license_type,
      license_id: license._id,
      license_code: license.license_type, // For backward compatibility
      status: license.status,
      assigned_at: license.assigned_at,
      expires_at: license.expires_at,
    };

  } catch (error) {
    console.error('❌ Error getting user effective license:', error);
    throw error;
  }
};

/**
 * Middleware: Require user to have ANY license
 * Blocks if user.license_id is null
 */
export const requireLicense = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED',
      });
    }

    const licenseInfo = await getUserEffectiveLicense(userId);

    if (!licenseInfo.has_license) {
      return res.status(403).json({
        success: false,
        message: licenseInfo.message || 'No license assigned',
        error: 'LICENSE_REQUIRED',
        suggestion: 'Please contact your organization admin to assign a license',
      });
    }

    // Attach license info to request for use in subsequent middleware/controllers
    req.userLicense = licenseInfo;
    next();

  } catch (error) {
    console.error('❌ Error in requireLicense middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking license',
      error: error.message,
    });
  }
};

/**
 * Middleware: Check if user's license type allows access to a feature
 * 
 * Usage: checkFeatureAccess('TASK_APPROVAL')
 */
export const checkFeatureAccess = (featureCode) => {
  return async (req, res, next) => {
    try {
      console.log(`\n🔐 [LICENSE CHECK] Feature: ${featureCode}`);

      const userId = req.user?.id || req.user?._id || req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED',
        });
      }

      // Get user's license
      const licenseInfo = await getUserEffectiveLicense(userId);

      if (!licenseInfo.has_license) {
        console.log(`❌ [LICENSE CHECK] User has no license`);
        return res.status(403).json({
          success: false,
          message: 'No license assigned',
          error: 'LICENSE_REQUIRED',
          feature: featureCode,
        });
      }

      console.log(`✅ [LICENSE CHECK] User has license: ${licenseInfo.license_type}`);

      // Get feature requirements
      const featureMapping = await LicenseFeatureMapping.findOne({
        feature_code: featureCode,
      }).populate('license_id');

      if (!featureMapping) {
        console.log(`⚠️ [LICENSE CHECK] Feature ${featureCode} not found in mappings`);
        // Feature not found in mappings - allow access by default (backward compatibility)
        return next();
      }

      // Get all license types that have access to this feature
      const allowedLicenses = await LicenseFeatureMapping.find({
        feature_code: featureCode,
        status: 'enabled',
      }).populate('license_id');

      const allowedLicenseCodes = allowedLicenses
        .map(mapping => mapping.license_id?.code)
        .filter(Boolean);

      console.log(`📋 [LICENSE CHECK] Allowed licenses for ${featureCode}:`, allowedLicenseCodes);

      // Check if user's license type is in allowed list
      if (!allowedLicenseCodes.includes(licenseInfo.license_type)) {
        console.log(`❌ [LICENSE CHECK] Access denied`);
        return res.status(403).json({
          success: false,
          message: `Your ${licenseInfo.license_type} license does not include access to this feature`,
          error: 'FEATURE_NOT_AVAILABLE',
          feature: featureCode,
          current_license: licenseInfo.license_type,
          required_licenses: allowedLicenseCodes,
        });
      }

      // Check usage limits
      const usageCheck = await checkUsageLimit(userId, featureCode, licenseInfo.license_type);

      if (!usageCheck.allowed) {
        console.log(`❌ [LICENSE CHECK] Usage limit exceeded`);
        return res.status(429).json({
          success: false,
          message: usageCheck.message,
          error: 'USAGE_LIMIT_EXCEEDED',
          feature: featureCode,
          usage: usageCheck.current,
          limit: usageCheck.limit,
        });
      }

      console.log(`✅ [LICENSE CHECK] Access granted`);

      // Attach license and feature info to request
      req.userLicense = licenseInfo;
      req.featureAccess = {
        feature_code: featureCode,
        allowed: true,
        usage: usageCheck,
      };

      next();

    } catch (error) {
      console.error('❌ Error in checkFeatureAccess middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking feature access',
        error: error.message,
      });
    }
  };
};

/**
 * Check if user has reached usage limit for a feature
 */
async function checkUsageLimit(userId, featureCode, licenseType) {
  try {
    // Get feature mapping for this license type
    const license = await License.findOne({ code: licenseType });
    if (!license) {
      return { allowed: true }; // No license found, allow by default
    }

    const featureMapping = await LicenseFeatureMapping.findOne({
      license_id: license._id,
      feature_code: featureCode,
    });

    if (!featureMapping) {
      return { allowed: true }; // No mapping found, allow by default
    }

    // Check if feature has usage limit
    if (featureMapping.usage_limit === -1 || featureMapping.usage_limit === null) {
      return { allowed: true }; // Unlimited usage
    }

    // Get current usage
    const usage = await FeatureUsageTracking.findOne({
      user_id: userId,
      feature_code: featureCode,
    });

    const currentUsage = usage?.usage_count || 0;
    const limit = featureMapping.usage_limit;

    if (currentUsage >= limit) {
      return {
        allowed: false,
        message: `You have reached the limit of ${limit} for this feature`,
        current: currentUsage,
        limit: limit,
      };
    }

    return {
      allowed: true,
      current: currentUsage,
      limit: limit,
      remaining: limit - currentUsage,
    };

  } catch (error) {
    console.error('Error checking usage limit:', error);
    return { allowed: true }; // Allow by default on error
  }
}

/**
 * Helper: Get feature access summary for user
 * Used by dashboards and UI to show/hide features
 */
export const getFeatureAccessSummary = async (userId) => {
  try {
    const licenseInfo = await getUserEffectiveLicense(userId);

    if (!licenseInfo.has_license) {
      return {
        has_license: false,
        license_type: null,
        features: {},
      };
    }

    // Get all features for this license type
    const license = await License.findOne({ code: licenseInfo.license_type });
    if (!license) {
      return {
        has_license: true,
        license_type: licenseInfo.license_type,
        features: {},
      };
    }

    const featureMappings = await LicenseFeatureMapping.find({
      license_id: license._id,
      status: 'enabled',
    });

    const features = {};

    for (const mapping of featureMappings) {
      const usageCheck = await checkUsageLimit(userId, mapping.feature_code, licenseInfo.license_type);
      
      features[mapping.feature_code] = {
        allowed: usageCheck.allowed,
        usage_limit: mapping.usage_limit,
        current_usage: usageCheck.current || 0,
        remaining: usageCheck.remaining || null,
      };
    }

    return {
      has_license: true,
      license_type: licenseInfo.license_type,
      license_id: licenseInfo.license_id,
      features: features,
    };

  } catch (error) {
    console.error('Error getting feature access summary:', error);
    throw error;
  }
};

/**
 * Track feature usage (increment counter)
 */
export const trackFeatureUsage = async (userId, featureCode) => {
  try {
    await FeatureUsageTracking.findOneAndUpdate(
      { user_id: userId, feature_code: featureCode },
      {
        $inc: { usage_count: 1 },
        $set: { last_used_at: new Date() },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Error tracking feature usage:', error);
    // Don't throw error - tracking is non-critical
  }
};

// Export for backward compatibility
export const getEffectiveLicense = getUserEffectiveLicense;
