/**
 * License Feature Enforcement Middleware
 * Checks if user has access to specific features based on their license
 * 
 * ✅ UPDATED v2: Uses USER-LEVEL licensing (each user has own license)
 */

import { User } from '../modals/userModal.js';
import { License } from '../modals/licenseModal.js';
import * as licenseService from '../services/licenseService.js';

/**
 * Middleware to check if user's license includes a specific feature
 * Usage: router.post('/api/tasks', requireFeature('TASK_ADVANCED'), createTask);
 * 
 * ✅ UPDATED: Now uses licenseService for consistent user-level checks
 * 
 * @param {string} feature - Feature code to check (e.g., 'TASK_ADVANCED', 'FORM_CREATE')
 * @returns {Function} Express middleware
 */
export const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // ✅ NEW: Use licenseService for consistent user-level feature check
      const accessCheck = await licenseService.checkFeatureAccess(userId, feature);

      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          success: false,
          message: accessCheck.message || `Feature '${feature}' not allowed`,
          required_feature: feature,
          current_license: accessCheck.subscription?.license_code,
          code: accessCheck.reason,
          trialExpired: accessCheck.trialExpired,
          showUpgradeModal: accessCheck.showUpgradeModal,
        });
      }

      // Feature allowed - attach license info to request
      req.license = {
        license_code: accessCheck.subscription?.license_code,
        status: accessCheck.subscription?.status,
        expiry: accessCheck.subscription?.expiry_date,
      };

      next();
    } catch (error) {
      console.error('❌ Error in requireFeature middleware:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking feature access',
        error: error.message
      });
    }
  };
};

/**
 * Middleware to check multiple features (user must have ALL)
 * Usage: router.post('/api/advanced-reports', requireFeatures(['REPORT_BASIC', 'REPORT_ADVANCED']))
 * 
 * ✅ UPDATED: Uses licenseService for user-level checks
 */
export const requireFeatures = (features = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // ✅ NEW: Check all features using licenseService
      const missingFeatures = [];
      let currentLicense = null;

      for (const feature of features) {
        const accessCheck = await licenseService.checkFeatureAccess(userId, feature);
        if (!accessCheck.hasAccess) {
          missingFeatures.push(feature);
        }
        if (!currentLicense && accessCheck.subscription) {
          currentLicense = accessCheck.subscription.license_code;
        }
      }

      if (missingFeatures.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Required features not available in your license',
          missing_features: missingFeatures,
          current_license: currentLicense,
          code: 'FEATURES_NOT_ALLOWED'
        });
      }

      next();
    } catch (error) {
      console.error('❌ Error in requireFeatures middleware:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking feature access',
        error: error.message
      });
    }
  };
};

/**
 * Middleware to check if user has ANY of the specified features
 * Usage: router.post('/api/reports', requireAnyFeature(['REPORT_BASIC', 'REPORT_ADVANCED']))
 * 
 * ✅ UPDATED: Uses licenseService for user-level checks
 */
export const requireAnyFeature = (features = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // ✅ NEW: Check if user has at least one feature using licenseService
      let hasAnyFeature = false;
      let currentLicense = null;

      for (const feature of features) {
        const accessCheck = await licenseService.checkFeatureAccess(userId, feature);
        if (accessCheck.hasAccess) {
          hasAnyFeature = true;
          break;
        }
        if (!currentLicense && accessCheck.subscription) {
          currentLicense = accessCheck.subscription.license_code;
        }
      }

      if (!hasAnyFeature) {
        return res.status(403).json({
          success: false,
          message: 'None of the required features available in your license',
          required_features: features,
          current_license: currentLicense,
          code: 'NO_REQUIRED_FEATURES'
        });
      }

      next();
    } catch (error) {
      console.error('❌ Error in requireAnyFeature middleware:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking feature access',
        error: error.message
      });
    }
  };
};

export {
  requireFeature,
  requireFeatures,
  requireAnyFeature
};
