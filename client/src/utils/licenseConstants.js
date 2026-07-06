/**
 * License Plan Constants
 * 
 * This file defines the canonical order for license plans:
 * Explore → Plan → Execute → Optimize
 * 
 * Use these constants throughout the application to ensure consistent ordering.
 */

// License plan order - Explore → Plan → Execute → Optimize
export const PLAN_ORDER = ['explore', 'plan', 'execute', 'optimize'];
export const PLAN_ORDER_UPPERCASE = ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'];

// License tier levels for comparison (higher is better)
export const LICENSE_TIER_LEVELS = {
    'EXPLORE': 1,
    'PLAN': 2,
    'EXECUTE': 3,
    'OPTIMIZE': 4,
    'explore': 1,
    'plan': 2,
    'execute': 3,
    'optimize': 4,
};

// Grace period days per license tier (for UI display; enforcement is server-side)
export const GRACE_PERIOD_DAYS = {
    'EXPLORE': 0,
    'PLAN': 5,
    'EXECUTE': 7,
    'OPTIMIZE': 10,
};

/**
 * Get ordered plan entries from a plans object
 * Ensures plans are always displayed in the correct sequence:
 * Explore → Plan → Execute → Optimize
 * 
 * @param {Object} plans - Plans object with plan keys as properties
 * @param {Object} options - Options
 * @param {boolean} options.excludeExpired - Whether to exclude expired plans (default: true)
 * @returns {Array} - Array of [key, plan] tuples in correct order
 */
export const getOrderedPlanEntries = (plans, options = { excludeExpired: true }) => {
    if (!plans || typeof plans !== 'object') return [];

    return PLAN_ORDER
        .filter(key => {
            if (!plans[key]) return false;
            if (options.excludeExpired && key === 'expired') return false;
            return true;
        })
        .map(key => [key, plans[key]]);
};

/**
 * Get ordered plan keys from a plans object
 * 
 * @param {Object} plans - Plans object with plan keys as properties
 * @returns {Array} - Array of plan keys in correct order
 */
export const getOrderedPlanKeys = (plans) => {
    if (!plans || typeof plans !== 'object') return [];

    return PLAN_ORDER.filter(key => plans[key]);
};

/**
 * Sort an array of plans by the correct order
 * 
 * @param {Array} plansArray - Array of plan objects with license_code or key property
 * @returns {Array} - Sorted array of plans
 */
export const sortPlansByOrder = (plansArray) => {
    if (!Array.isArray(plansArray)) return [];

    return [...plansArray].sort((a, b) => {
        const aKey = (a.license_code || a.key || '').toLowerCase();
        const bKey = (b.license_code || b.key || '').toLowerCase();
        const aIndex = PLAN_ORDER.indexOf(aKey);
        const bIndex = PLAN_ORDER.indexOf(bKey);

        // If not in PLAN_ORDER, put at the end
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;

        return aIndex - bIndex;
    });
};

/**
 * Compare two plan tiers
 * 
 * @param {string} planA - First plan code
 * @param {string} planB - Second plan code
 * @returns {number} - Negative if A < B, 0 if equal, positive if A > B
 */
export const comparePlanTiers = (planA, planB) => {
    const levelA = LICENSE_TIER_LEVELS[planA] || 0;
    const levelB = LICENSE_TIER_LEVELS[planB] || 0;
    return levelA - levelB;
};

/**
 * Check if a plan is higher tier than another
 * 
 * @param {string} planA - Plan to check
 * @param {string} planB - Plan to compare against
 * @returns {boolean} - True if planA is higher tier than planB
 */
export const isHigherTier = (planA, planB) => {
    return comparePlanTiers(planA, planB) > 0;
};

/**
 * Check if upgrading from one plan to another
 * 
 * @param {string} currentPlan - Current plan code
 * @param {string} targetPlan - Target plan code
 * @returns {boolean} - True if this is an upgrade
 */
export const isUpgrade = (currentPlan, targetPlan) => {
    return isHigherTier(targetPlan, currentPlan);
};

/**
 * Check if downgrading from one plan to another
 * 
 * @param {string} currentPlan - Current plan code
 * @param {string} targetPlan - Target plan code
 * @returns {boolean} - True if this is a downgrade
 */
export const isDowngrade = (currentPlan, targetPlan) => {
    return isHigherTier(currentPlan, targetPlan);
};

export default {
    PLAN_ORDER,
    PLAN_ORDER_UPPERCASE,
    LICENSE_TIER_LEVELS,
    GRACE_PERIOD_DAYS,
    getOrderedPlanEntries,
    getOrderedPlanKeys,
    sortPlansByOrder,
    comparePlanTiers,
    isHigherTier,
    isUpgrade,
    isDowngrade,
};
