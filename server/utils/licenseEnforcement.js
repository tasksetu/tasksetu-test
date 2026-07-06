/**
 * License Enforcement Utilities
 * 
 * Central location for all license checking logic.
 * 
 * 🆕 NEW MODEL: User → LicenseInstance → License
 * 
 * Key Principles:
 * - Check user.license_instance_id (NOT user.license_code)
 * - Atomic enforcement - no seat counting
 * - Support admin self-licensing
 * - Clear error messages
 */

import LicenseInstance from '../modals/licenseInstanceModal.js';
import { License } from '../modals/licenseModal.js';
import { User } from '../modals/userModal.js';
import TimezoneHelper from './timezoneHelper.js';

/**
 * Get user's active license with full details
 * @param {string|ObjectId} userId - User ID
 * @returns {Object|null} License details or null if no license
 */
export async function getUserLicense(userId) {
    const user = await User.findById(userId).populate('license_instance_id');

    if (!user) {
        return null;
    }

    // Check new atomic license system first
    if (user.license_instance_id) {
        const instance = user.license_instance_id;

        // Check if expired
        if (instance.isExpired()) {
            return {
                hasLicense: false,
                isExpired: true,
                license_code: instance.license_code,
                expiry_date: instance.renewal_date,
                message: `Your ${instance.license_code} license expired on ${TimezoneHelper.formatInTimezone(instance.renewal_date, await TimezoneHelper.getUserTimezone(userId))}`
            };
        }

        // Get license definition
        const licenseDef = await License.findOne({ license_code: instance.license_code });

        return {
            hasLicense: true,
            isExpired: false,
            license_code: instance.license_code,
            license_name: licenseDef?.name,
            renewal_date: instance.renewal_date,
            assigned_at: instance.assigned_at,
            features: licenseDef?.features || [],
            limits: {
                max_users: licenseDef?.max_users,
                max_tasks: licenseDef?.max_tasks,
                max_projects: licenseDef?.max_projects,
                max_storage_gb: licenseDef?.max_storage_gb
            }
        };
    }

    // Fallback to legacy license_code (for individual accounts or during migration)
    if (user.license_code) {
        const licenseDef = await License.findOne({ license_code: user.license_code });

        return {
            hasLicense: true,
            isExpired: false,
            license_code: user.license_code,
            license_name: licenseDef?.name,
            isLegacy: true,
            features: licenseDef?.features || [],
            limits: {
                max_users: licenseDef?.max_users,
                max_tasks: licenseDef?.max_tasks,
                max_projects: licenseDef?.max_projects,
                max_storage_gb: licenseDef?.max_storage_gb
            }
        };
    }

    // No license assigned
    return {
        hasLicense: false,
        isExpired: false,
        message: 'No license assigned. Please contact your administrator.'
    };
}

/**
 * Check if user has a valid license
 * @param {string|ObjectId} userId - User ID
 * @returns {boolean} True if user has valid license
 */
export async function hasValidLicense(userId) {
    const license = await getUserLicense(userId);
    return license && license.hasLicense && !license.isExpired;
}

/**
 * Check if user's license includes a specific feature
 * @param {string|ObjectId} userId - User ID
 * @param {string} featureCode - Feature code to check
 * @returns {boolean} True if user has access to feature
 */
export async function hasFeatureAccess(userId, featureCode) {
    const license = await getUserLicense(userId);

    if (!license || !license.hasLicense || license.isExpired) {
        return false;
    }

    // Check if feature is in license
    return license.features?.includes(featureCode) || false;
}

/**
 * Middleware: Require valid license
 * Use this in routes that require ANY valid license
 */
export const requireLicense = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.userId;
        const license = await getUserLicense(userId);

        if (!license || !license.hasLicense) {
            return res.status(403).json({
                success: false,
                message: license?.message || 'No license assigned',
                code: 'NO_LICENSE'
            });
        }

        if (license.isExpired) {
            return res.status(403).json({
                success: false,
                message: license.message,
                code: 'LICENSE_EXPIRED',
                expiry_date: license.expiry_date
            });
        }

        // Attach license info to request for downstream use
        req.userLicense = license;
        next();

    } catch (error) {
        console.error('License check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify license',
            error: error.message
        });
    }
};

/**
 * Middleware: Require specific license type
 * @param {string|string[]} requiredLicenses - License code(s) required
 * 
 * Example: requireLicenseType('OPTIMIZE')
 * Example: requireLicenseType(['EXECUTE', 'OPTIMIZE'])
 */
export const requireLicenseType = (requiredLicenses) => {
    const licenses = Array.isArray(requiredLicenses) ? requiredLicenses : [requiredLicenses];

    return async (req, res, next) => {
        try {
            const userId = req.user._id || req.user.userId;
            const license = await getUserLicense(userId);

            if (!license || !license.hasLicense) {
                return res.status(403).json({
                    success: false,
                    message: 'No license assigned',
                    code: 'NO_LICENSE',
                    required_licenses: licenses
                });
            }

            if (license.isExpired) {
                return res.status(403).json({
                    success: false,
                    message: license.message,
                    code: 'LICENSE_EXPIRED'
                });
            }

            if (!licenses.includes(license.license_code)) {
                return res.status(403).json({
                    success: false,
                    message: `This feature requires ${licenses.join(' or ')} license. You have ${license.license_code}.`,
                    code: 'INSUFFICIENT_LICENSE',
                    current_license: license.license_code,
                    required_licenses: licenses
                });
            }

            req.userLicense = license;
            next();

        } catch (error) {
            console.error('License type check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify license',
                error: error.message
            });
        }
    };
};

/**
 * Middleware: Require specific feature
 * @param {string} featureCode - Feature code required
 * 
 * Example: requireFeature('CUSTOM_FORMS')
 */
export const requireFeature = (featureCode) => {
    return async (req, res, next) => {
        try {
            const userId = req.user._id || req.user.userId;
            const hasAccess = await hasFeatureAccess(userId, featureCode);

            if (!hasAccess) {
                const license = await getUserLicense(userId);

                return res.status(403).json({
                    success: false,
                    message: `Your ${license?.license_code || 'current'} license does not include access to this feature.`,
                    code: 'FEATURE_NOT_INCLUDED',
                    feature_code: featureCode,
                    current_license: license?.license_code
                });
            }

            next();

        } catch (error) {
            console.error('Feature check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify feature access',
                error: error.message
            });
        }
    };
};

/**
 * Check if user has reached license limit
 * @param {string|ObjectId} userId - User ID
 * @param {string} limitType - Type of limit (tasks, projects, storage)
 * @param {number} currentUsage - Current usage count
 * @returns {Object} { withinLimit: boolean, limit: number, usage: number }
 */
export async function checkLicenseLimit(userId, limitType, currentUsage) {
    const license = await getUserLicense(userId);

    if (!license || !license.hasLicense) {
        return {
            withinLimit: false,
            limit: 0,
            usage: currentUsage,
            message: 'No license assigned'
        };
    }

    const limits = license.limits || {};
    let limit;

    switch (limitType) {
        case 'tasks':
            limit = limits.max_tasks;
            break;
        case 'projects':
            limit = limits.max_projects;
            break;
        case 'users':
            limit = limits.max_users;
            break;
        case 'storage':
            limit = limits.max_storage_gb;
            break;
        default:
            return { withinLimit: true, limit: Infinity, usage: currentUsage };
    }

    // Unlimited = -1 or null
    if (!limit || limit === -1) {
        return { withinLimit: true, limit: Infinity, usage: currentUsage };
    }

    return {
        withinLimit: currentUsage < limit,
        limit,
        usage: currentUsage,
        message: currentUsage >= limit ? `You have reached your ${limitType} limit (${limit})` : null
    };
}

/**
 * Get license hierarchy for upgrade path
 * Returns licenses in order: EXPLORE < PLAN < EXECUTE < OPTIMIZE
 */
export function getLicenseHierarchy() {
    // Import from constants for consistency
    const { PLAN_ORDER_UPPERCASE } = require('./licenseConstants.js');
    return PLAN_ORDER_UPPERCASE;
}

/**
 * Check if license A is better than or equal to license B
 * @param {string} licenseA - License code A
 * @param {string} licenseB - License code B
 * @returns {boolean}
 */
export function isLicenseAtLeast(licenseA, licenseB) {
    const hierarchy = getLicenseHierarchy();
    return hierarchy.indexOf(licenseA) >= hierarchy.indexOf(licenseB);
}

export default {
    getUserLicense,
    hasValidLicense,
    hasFeatureAccess,
    requireLicense,
    requireLicenseType,
    requireFeature,
    checkLicenseLimit,
    getLicenseHierarchy,
    isLicenseAtLeast
};
