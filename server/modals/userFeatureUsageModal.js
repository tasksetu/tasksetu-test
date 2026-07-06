import mongoose from 'mongoose';
import { FeatureUsageTracking } from './featureUsageTrackingModal.js';

/**
 * User Feature Usage Schema
 * 
 * ✅ CORE CONCEPT: Usage is FEATURE-based, independent of LicenseInstance
 * 
 * Key Principles:
 * - LicenseInstance is ACCESS, not USAGE
 * - Usage is per user, not per license instance
 * - Upgrade NEVER deletes usage - only changes the ceiling
 * - Downgrade is VALIDATED - only allowed if current usage fits target license
 * 
 * Period Key Rules:
 * - TOTAL: "TOTAL" (never resets)
 * - MONTHLY: "YYYY-MM" (resets each month)
 * - DAILY: "YYYY-MM-DD" (resets each day)
 */
const userFeatureUsageSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        feature_code: {
            type: String,
            required: true,
            uppercase: true,
        },

        period_key: {
            type: String,
            default: 'TOTAL',
            /**
             * Examples:
             * - "TOTAL" (for TOTAL limit_type - never resets)
             * - "2025-01" (for MONTHLY limit_type)
             * - "2025-01-22" (for DAILY limit_type)
             */
        },

        limit_type: {
            type: String,
            enum: ['DAILY', 'MONTHLY', 'TOTAL', 'NONE'],
            required: true,
        },

        used_count: {
            type: Number,
            default: 0,
            min: 0,
        },

        last_used_at: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

/**
 * Ensure one row per (user, feature, period)
 */
userFeatureUsageSchema.index(
    { user_id: 1, feature_code: 1, period_key: 1 },
    { unique: true }
);

// Compound indexes for efficient queries
userFeatureUsageSchema.index({ user_id: 1, limit_type: 1 });
userFeatureUsageSchema.index({ feature_code: 1, period_key: 1 });

/**
 * Instance Methods
 */

// Increment usage count
userFeatureUsageSchema.methods.incrementUsage = async function (amount = 1) {
    this.used_count += amount;
    this.last_used_at = new Date();
    return this.save();
};

// Decrement usage count (for undo/delete operations)
userFeatureUsageSchema.methods.decrementUsage = async function (amount = 1) {
    this.used_count = Math.max(0, this.used_count - amount);
    return this.save();
};

/**
 * Static Methods
 */

/**
 * Get the correct period_key based on limit_type
 * @param {String} limitType - DAILY, MONTHLY, TOTAL, or NONE
 * @returns {String} period_key
 */
userFeatureUsageSchema.statics.getPeriodKey = function (limitType) {
    const now = new Date();

    switch (limitType) {
        case 'DAILY':
            return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
        case 'MONTHLY':
            return now.toISOString().slice(0, 7); // "YYYY-MM"
        case 'TOTAL':
        case 'NONE':
        default:
            return 'TOTAL';
    }
};

/**
 * Get or create usage record for a user + feature + period
 * @param {ObjectId} userId - User ID
 * @param {String} featureCode - Feature code
 * @param {String} limitType - DAILY, MONTHLY, TOTAL, or NONE
 * @param {Object} session - Optional MongoDB session for transactions
 * @returns {Promise<Object>} Usage record
 */
userFeatureUsageSchema.statics.getOrCreateUsage = async function (
    userId,
    featureCode,
    limitType,
    session = null
) {
    const periodKey = this.getPeriodKey(limitType);

    const query = {
        user_id: userId,
        feature_code: featureCode.toUpperCase(),
        period_key: periodKey,
    };

    let usage = session
        ? await this.findOne(query).session(session)
        : await this.findOne(query);

    if (!usage) {
        const createData = {
            ...query,
            limit_type: limitType,
            used_count: 0,
        };

        if (session) {
            const created = await this.create([createData], { session });
            usage = created[0];
        } else {
            usage = await this.create(createData);
        }
    }

    return usage;
};

/**
 * Consume feature usage (increment count)
 * @param {ObjectId} userId - User ID
 * @param {String} featureCode - Feature code
 * @param {String} limitType - DAILY, MONTHLY, TOTAL, or NONE
 * @param {Number} amount - Amount to consume (default: 1)
 * @param {Object} session - Optional MongoDB session for transactions
 * @returns {Promise<Object>} Updated usage record
 */
userFeatureUsageSchema.statics.consumeUsage = async function (
    userId,
    featureCode,
    limitType,
    amount = 1,
    session = null
) {
    const periodKey = this.getPeriodKey(limitType);
    const featureCodeUpper = featureCode.toUpperCase();

    console.log(`\n📊 [UserFeatureUsage.consumeUsage] START - user: ${userId}, feature: ${featureCodeUpper}, limitType: ${limitType}, periodKey: ${periodKey}, amount: ${amount}`);

    const query = {
        user_id: userId,
        feature_code: featureCodeUpper,
        period_key: periodKey,
    };

    // Check if there's an existing record with current period_key
    const existingRecord = session
        ? await this.findOne(query).session(session)
        : await this.findOne(query);

    const currentPeriodUsage = existingRecord?.used_count || 0;
    console.log(`📊 [UserFeatureUsage.consumeUsage] Existing record with periodKey=${periodKey}:`, existingRecord ? `found (used_count: ${currentPeriodUsage})` : 'NOT FOUND');

    // ✅ FIX: ALWAYS check ALL period_keys to find the maximum usage
    // This ensures we're incrementing from the highest usage value
    // regardless of which period_key it's stored in
    let maxUsageAcrossPeriods = currentPeriodUsage;

    // Check TOTAL period_key (for usage from unlimited license)
    if (periodKey !== 'TOTAL') {
        const totalRecord = session
            ? await this.findOne({ user_id: userId, feature_code: featureCodeUpper, period_key: 'TOTAL' }).session(session)
            : await this.findOne({ user_id: userId, feature_code: featureCodeUpper, period_key: 'TOTAL' });

        if (totalRecord && totalRecord.used_count > maxUsageAcrossPeriods) {
            console.log(`📊 [UserFeatureUsage.consumeUsage] Found higher TOTAL usage: ${totalRecord.used_count} > current ${maxUsageAcrossPeriods}`);
            maxUsageAcrossPeriods = totalRecord.used_count;
        }
    }

    // Check current MONTHLY period_key (for usage from limited license)
    const monthlyPeriodKey = this.getPeriodKey('MONTHLY');
    if (periodKey !== monthlyPeriodKey) {
        const monthlyRecord = session
            ? await this.findOne({ user_id: userId, feature_code: featureCodeUpper, period_key: monthlyPeriodKey }).session(session)
            : await this.findOne({ user_id: userId, feature_code: featureCodeUpper, period_key: monthlyPeriodKey });

        if (monthlyRecord && monthlyRecord.used_count > maxUsageAcrossPeriods) {
            console.log(`📊 [UserFeatureUsage.consumeUsage] Found higher MONTHLY (${monthlyPeriodKey}) usage: ${monthlyRecord.used_count} > current ${maxUsageAcrossPeriods}`);
            maxUsageAcrossPeriods = monthlyRecord.used_count;
        }
    }

    // Calculate the new usage value
    const newUsageValue = maxUsageAcrossPeriods + amount;
    console.log(`📊 [UserFeatureUsage.consumeUsage] Max usage across periods: ${maxUsageAcrossPeriods}, New value will be: ${newUsageValue}`);

    // Use findOneAndUpdate with upsert for atomic operation
    // Always use $set with the calculated value to ensure consistency
    const update = {
        $set: {
            used_count: newUsageValue,
            last_used_at: new Date(),
            limit_type: limitType,
        },
        $setOnInsert: {
            user_id: userId,
            feature_code: featureCodeUpper,
            period_key: periodKey,
        },
    };

    const options = {
        upsert: true,
        new: true,
        ...(session && { session }),
    };

    const result = await this.findOneAndUpdate(query, update, options);
    console.log(`📊 [UserFeatureUsage.consumeUsage] END - Result: periodKey=${result.period_key}, used_count=${result.used_count}\n`);

    return result;
};

/**
 * Get current usage for a user + feature
 * 
 * ✅ FALLBACK: If no data in UserFeatureUsage, check legacy FeatureUsageTracking
 * 
 * @param {ObjectId} userId - User ID
 * @param {String} featureCode - Feature code
 * @param {String} limitType - DAILY, MONTHLY, TOTAL, or NONE
 * @returns {Promise<Number>} Current usage count
 */
userFeatureUsageSchema.statics.getCurrentUsage = async function (
    userId,
    featureCode,
    limitType
) {
    const periodKey = this.getPeriodKey(limitType);
    const featureCodeUpper = featureCode.toUpperCase();

    const usage = await this.findOne({
        user_id: userId,
        feature_code: featureCodeUpper,
        period_key: periodKey,
    }).lean();

    let used = usage?.used_count || 0;

    // ✅ FIX: Check ALL period_keys to find the maximum usage
    // This ensures usage is preserved regardless of license changes

    // Check TOTAL period_key (for usage tracked with unlimited licenses)
    if (periodKey !== 'TOTAL') {
        const totalUsage = await this.findOne({
            user_id: userId,
            feature_code: featureCodeUpper,
            period_key: 'TOTAL',
        }).lean();
        if (totalUsage && totalUsage.used_count > used) {
            used = totalUsage.used_count;
            console.log(`📊 [UserFeatureUsage.getCurrentUsage] Found higher TOTAL usage for ${featureCodeUpper}: ${used}`);
        }
    }

    // Check current MONTHLY period_key (for usage tracked with limited licenses)
    const monthlyPeriodKey = this.getPeriodKey('MONTHLY');
    if (periodKey !== monthlyPeriodKey) {
        const monthlyUsage = await this.findOne({
            user_id: userId,
            feature_code: featureCodeUpper,
            period_key: monthlyPeriodKey,
        }).lean();
        if (monthlyUsage && monthlyUsage.used_count > used) {
            used = monthlyUsage.used_count;
            console.log(`📊 [UserFeatureUsage.getCurrentUsage] Found higher MONTHLY usage for ${featureCodeUpper}: ${used}`);
        }
    }

    // ✅ FALLBACK: If no usage in new model, check legacy FeatureUsageTracking
    if (used === 0) {
        try {
            // ✅ IMPORTANT: Legacy model uses 'TOTAL' for both TOTAL and NONE limit types
            const legacyLimitType = (limitType === 'NONE') ? 'TOTAL' : limitType;
            const { start } = FeatureUsageTracking.getCurrentPeriod(legacyLimitType);
            const legacyUsage = await FeatureUsageTracking.findOne({
                user_id: userId,
                feature_code: featureCodeUpper,
                period_start: start,
                usage_period: legacyLimitType,
            }).lean();

            if (legacyUsage && legacyUsage.usage_count > 0) {
                used = legacyUsage.usage_count;
                console.log(`📊 [UserFeatureUsage.getCurrentUsage] Fallback to legacy: user=${userId}, feature=${featureCode}, used=${used}`);
            }

            // ✅ FIX: Also check legacy TOTAL if current limit_type is MONTHLY
            if (used === 0 && limitType === 'MONTHLY') {
                const legacyTotalUsage = await FeatureUsageTracking.findOne({
                    user_id: userId,
                    feature_code: featureCodeUpper,
                    usage_period: 'TOTAL',
                }).lean();

                if (legacyTotalUsage && legacyTotalUsage.usage_count > 0) {
                    used = legacyTotalUsage.usage_count;
                    console.log(`📊 [UserFeatureUsage.getCurrentUsage] Fallback to legacy TOTAL: user=${userId}, feature=${featureCode}, used=${used}`);
                }
            }
        } catch (err) {
            // Ignore errors from legacy model
        }
    }

    return used;
};

/**
 * Get all usage records for a user
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Array>} Array of usage records with current period data
 */
userFeatureUsageSchema.statics.getUserAllUsage = async function (userId) {
    // Get all distinct feature codes for this user
    const usageRecords = await this.find({ user_id: userId })
        .sort({ feature_code: 1, period_key: -1 })
        .lean();

    return usageRecords;
};

/**
 * Get all current usage for a user (grouped by feature with current period values)
 * 
 * ✅ FALLBACK: If no data in UserFeatureUsage, check legacy FeatureUsageTracking
 * 
 * @param {ObjectId} userId - User ID
 * @param {Array} featureMappings - Array of { feature_code, limit_type, usage_limit }
 * @returns {Promise<Object>} Usage map { feature_code: { used, limit, remaining, ... } }
 */
userFeatureUsageSchema.statics.getUserCurrentUsage = async function (
    userId,
    featureMappings
) {
    const usageMap = {};

    for (const mapping of featureMappings) {
        const limitType = mapping.limit_type || 'MONTHLY';
        const periodKey = this.getPeriodKey(limitType);
        const featureCodeUpper = mapping.feature_code.toUpperCase();

        // First, check the new UserFeatureUsage model with current period_key
        let usage = await this.findOne({
            user_id: userId,
            feature_code: featureCodeUpper,
            period_key: periodKey,
        }).lean();

        let used = usage?.used_count || 0;

        // ✅ FIX: Check ALL period_keys to find the maximum usage
        // This ensures usage is preserved regardless of license changes

        // Check TOTAL period_key (for usage tracked with unlimited licenses)
        if (periodKey !== 'TOTAL') {
            const totalUsage = await this.findOne({
                user_id: userId,
                feature_code: featureCodeUpper,
                period_key: 'TOTAL',
            }).lean();
            if (totalUsage && totalUsage.used_count > used) {
                used = totalUsage.used_count;
                console.log(`📊 [UserFeatureUsage] Found higher TOTAL usage for ${featureCodeUpper}: ${used}`);
            }
        }

        // Check current MONTHLY period_key (for usage tracked with limited licenses)
        const monthlyPeriodKey = this.getPeriodKey('MONTHLY');
        if (periodKey !== monthlyPeriodKey) {
            const monthlyUsage = await this.findOne({
                user_id: userId,
                feature_code: featureCodeUpper,
                period_key: monthlyPeriodKey,
            }).lean();
            if (monthlyUsage && monthlyUsage.used_count > used) {
                used = monthlyUsage.used_count;
                console.log(`📊 [UserFeatureUsage] Found higher MONTHLY usage for ${featureCodeUpper}: ${used}`);
            }
        }

        // ✅ FALLBACK: If no usage in new model, check legacy FeatureUsageTracking
        if (used === 0) {
            try {
                // ✅ IMPORTANT: Legacy model uses 'TOTAL' for both TOTAL and NONE limit types
                const legacyLimitType = (limitType === 'NONE') ? 'TOTAL' : limitType;
                const { start, end } = FeatureUsageTracking.getCurrentPeriod(legacyLimitType);
                const legacyUsage = await FeatureUsageTracking.findOne({
                    user_id: userId,
                    feature_code: mapping.feature_code,
                    period_start: start,
                    usage_period: legacyLimitType,
                }).lean();

                if (legacyUsage && legacyUsage.usage_count > 0) {
                    used = legacyUsage.usage_count;
                    console.log(`📊 [UserFeatureUsage] Fallback to legacy: user=${userId}, feature=${mapping.feature_code}, used=${used}`);
                }

                // ✅ FIX: Also check legacy TOTAL if current limit_type is MONTHLY
                if (used === 0 && limitType === 'MONTHLY') {
                    const legacyTotalUsage = await FeatureUsageTracking.findOne({
                        user_id: userId,
                        feature_code: mapping.feature_code,
                        usage_period: 'TOTAL',
                    }).lean();

                    if (legacyTotalUsage && legacyTotalUsage.usage_count > 0) {
                        used = legacyTotalUsage.usage_count;
                        console.log(`📊 [UserFeatureUsage] Fallback to legacy TOTAL: user=${userId}, feature=${mapping.feature_code}, used=${used}`);
                    }
                }
            } catch (err) {
                // Ignore errors from legacy model - it might not exist
                console.log(`📊 [UserFeatureUsage] Legacy model check failed: ${err.message}`);
            }
        }

        const limit = mapping.usage_limit;
        const isUnlimited = limit === -1;

        usageMap[mapping.feature_code] = {
            used,
            limit,
            remaining: isUnlimited ? -1 : Math.max(0, limit - used),
            isUnlimited,
            percentage: isUnlimited || limit === 0 ? 0 : Math.round((used / limit) * 100),
            limitType: mapping.limit_type,
            periodKey,
        };
    }

    return usageMap;
};

/**
 * Validate if downgrade is allowed based on current usage vs target limits
 * 
 * ✅ FALLBACK: Also checks legacy FeatureUsageTracking if new model has no data
 * ✅ FIX: Also checks TOTAL period_key when target has MONTHLY limit_type
 * 
 * @param {ObjectId} userId - User ID
 * @param {Array} targetMappings - Target license feature mappings
 * @returns {Promise<Object>} { allowed: boolean, violations: Array }
 */
userFeatureUsageSchema.statics.validateDowngrade = async function (
    userId,
    targetMappings
) {
    const violations = [];

    for (const mapping of targetMappings) {
        // Skip if unlimited in target
        if (mapping.usage_limit === -1) continue;

        // Skip if feature not enabled in target
        if (!mapping.is_enabled) continue;

        const limitType = mapping.limit_type || 'MONTHLY';
        const periodKey = this.getPeriodKey(limitType);
        const featureCodeUpper = mapping.feature_code.toUpperCase();

        // First check new model with target's period_key
        let usage = await this.findOne({
            user_id: userId,
            feature_code: featureCodeUpper,
            period_key: periodKey,
        }).lean();

        let used = usage?.used_count || 0;

        // ✅ FIX: Also check TOTAL period_key if current limit_type is not TOTAL/NONE
        // This handles usage stored when user had unlimited license (NONE/TOTAL)
        if (used === 0 && limitType !== 'TOTAL' && limitType !== 'NONE') {
            const totalUsage = await this.findOne({
                user_id: userId,
                feature_code: featureCodeUpper,
                period_key: 'TOTAL',
            }).lean();

            if (totalUsage && totalUsage.used_count > 0) {
                used = totalUsage.used_count;
                console.log(`📊 [validateDowngrade] Found TOTAL period usage for ${featureCodeUpper}: ${used}`);
            }
        }

        // ✅ FALLBACK: Check legacy model if no data in new model
        if (used === 0) {
            try {
                // ✅ IMPORTANT: Legacy model uses 'TOTAL' for both TOTAL and NONE limit types
                const legacyLimitType = (limitType === 'NONE') ? 'TOTAL' : limitType;
                const { start } = FeatureUsageTracking.getCurrentPeriod(legacyLimitType);
                const legacyUsage = await FeatureUsageTracking.findOne({
                    user_id: userId,
                    feature_code: featureCodeUpper,
                    period_start: start,
                    usage_period: legacyLimitType,
                }).lean();

                if (legacyUsage && legacyUsage.usage_count > 0) {
                    used = legacyUsage.usage_count;
                }

                // ✅ FIX: Also check legacy TOTAL if current limit_type is MONTHLY
                if (used === 0 && limitType === 'MONTHLY') {
                    const legacyTotalUsage = await FeatureUsageTracking.findOne({
                        user_id: userId,
                        feature_code: featureCodeUpper,
                        usage_period: 'TOTAL',
                    }).lean();

                    if (legacyTotalUsage && legacyTotalUsage.usage_count > 0) {
                        used = legacyTotalUsage.usage_count;
                        console.log(`📊 [validateDowngrade] Fallback to legacy TOTAL: ${featureCodeUpper}, used=${used}`);
                    }
                }
            } catch (err) {
                // Ignore errors from legacy model
            }
        }

        if (used > mapping.usage_limit) {
            violations.push({
                feature_code: featureCodeUpper,
                used,
                allowed: mapping.usage_limit,
                limit_type: mapping.limit_type,
                excess: used - mapping.usage_limit,
                message: `Current usage (${used}) exceeds target limit (${mapping.usage_limit})`,
            });
        }
    }

    return {
        allowed: violations.length === 0,
        violations,
    };
};

export const UserFeatureUsage = mongoose.model(
    'UserFeatureUsage',
    userFeatureUsageSchema
);
