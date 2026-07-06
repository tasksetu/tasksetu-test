/**
 * License Plan Constants for Server-side
 * 
 * This file defines the canonical order for license plans:
 * Explore → Plan → Execute → Optimize
 * 
 * Use these constants throughout the server application to ensure consistent ordering.
 */

// License plan order - Explore → Plan → Execute → Optimize
export const PLAN_ORDER = ['explore', 'plan', 'execute', 'optimize'];
export const PLAN_ORDER_UPPERCASE = ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'];

// Valid license types (including EXPIRED for system use)
export const VALID_LICENSE_TYPES = ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'];
export const ALL_LICENSE_TYPES = ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE', 'EXPIRED'];

// License tier levels for comparison (higher is better)
export const LICENSE_TIER_LEVELS = {
    'EXPLORE': 1,
    'PLAN': 2,
    'EXECUTE': 3,
    'OPTIMIZE': 4,
    'EXPIRED': 0,
};

// Display order for database seeding and sorting
export const LICENSE_DISPLAY_ORDER = {
    'EXPLORE': 1,
    'PLAN': 2,
    'EXECUTE': 3,
    'OPTIMIZE': 4,
    'EXPIRED': 99,
};

/**
 * Sort an array of licenses by the correct order
 * 
 * @param {Array} licenses - Array of license objects with license_code property
 * @returns {Array} - Sorted array of licenses
 */
export const sortLicensesByOrder = (licenses) => {
    if (!Array.isArray(licenses)) return [];

    return [...licenses].sort((a, b) => {
        const aCode = (a.license_code || '').toUpperCase();
        const bCode = (b.license_code || '').toUpperCase();
        const aOrder = LICENSE_DISPLAY_ORDER[aCode] || 99;
        const bOrder = LICENSE_DISPLAY_ORDER[bCode] || 99;
        return aOrder - bOrder;
    });
};

/**
 * Validate if a license code is valid
 * 
 * @param {string} licenseCode - License code to validate
 * @returns {boolean} - True if valid
 */
export const isValidLicenseType = (licenseCode) => {
    if (!licenseCode) return false;
    return VALID_LICENSE_TYPES.includes(licenseCode.toUpperCase());
};

/**
 * Compare two license tiers
 * 
 * @param {string} licenseA - First license code
 * @param {string} licenseB - Second license code
 * @returns {number} - Negative if A < B, 0 if equal, positive if A > B
 */
export const compareLicenseTiers = (licenseA, licenseB) => {
    const levelA = LICENSE_TIER_LEVELS[licenseA?.toUpperCase()] || 0;
    const levelB = LICENSE_TIER_LEVELS[licenseB?.toUpperCase()] || 0;
    return levelA - levelB;
};

/**
 * Check if a license is higher tier than another
 * 
 * @param {string} licenseA - License to check
 * @param {string} licenseB - License to compare against
 * @returns {boolean} - True if licenseA is higher tier than licenseB
 */
export const isHigherTier = (licenseA, licenseB) => {
    return compareLicenseTiers(licenseA, licenseB) > 0;
};

/**
 * Check if upgrading from one license to another
 * 
 * @param {string} currentLicense - Current license code
 * @param {string} targetLicense - Target license code
 * @returns {boolean} - True if this is an upgrade
 */
export const isUpgrade = (currentLicense, targetLicense) => {
    return isHigherTier(targetLicense, currentLicense);
};

/**
 * Check if downgrading from one license to another
 * 
 * @param {string} currentLicense - Current license code
 * @param {string} targetLicense - Target license code
 * @returns {boolean} - True if this is a downgrade
 */
export const isDowngrade = (currentLicense, targetLicense) => {
    return isHigherTier(currentLicense, targetLicense);
};

export default {
    PLAN_ORDER,
    PLAN_ORDER_UPPERCASE,
    VALID_LICENSE_TYPES,
    ALL_LICENSE_TYPES,
    LICENSE_TIER_LEVELS,
    LICENSE_DISPLAY_ORDER,
    sortLicensesByOrder,
    isValidLicenseType,
    compareLicenseTiers,
    isHigherTier,
    isUpgrade,
    isDowngrade,
};
