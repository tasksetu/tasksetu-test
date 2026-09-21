import mongoose from 'mongoose';

/**
 * License Instance Feature Usage Model
 * 
 * ✅ CORE CONCEPT: Usage is SEAT-BASED (tied to LicenseInstance)
 * 
 * Key Principles:
 * - Each LicenseInstance document has its own feature usage tracking.
 * - When an admin unassigns a license from User A and reassigns it to User B,
 *   User B inherits the used_count on this LicenseInstance seat.
 * - PERIOD KEYS:
 *   - MONTHLY: "YYYY-MM" (resets every calendar month)
 *   - DAILY: "YYYY-MM-DD" (resets every calendar day)
 *   - TOTAL: "CYCLE-YYYY-MM-DD" keyed by the instance's renewal_date.
 *            When the license renews, renewal_date changes and usage resets for the new cycle.
 *            Fallback to "TOTAL" if no renewal_date exists.
 */
const licenseInstanceFeatureUsageSchema = new mongoose.Schema(
    {
        license_instance_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LicenseInstance',
            required: true,
            index: true,
        },

        organization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
            index: true,
        },

        feature_code: {
            type: String,
            required: true,
            uppercase: true,
            index: true,
        },

        period_key: {
            type: String,
            default: 'TOTAL',
            index: true,
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

        last_used_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        }
    },
    { timestamps: true }
);

// Compound index for fast lookup and uniqueness per seat + feature + period
licenseInstanceFeatureUsageSchema.index(
    { license_instance_id: 1, feature_code: 1, period_key: 1 },
    { unique: true }
);

licenseInstanceFeatureUsageSchema.index({ license_instance_id: 1, limit_type: 1 });
licenseInstanceFeatureUsageSchema.index({ organization_id: 1, feature_code: 1 });

/**
 * Static Methods
 */

/**
 * Generate period_key based on limit_type and license instance renewal_date
 */
licenseInstanceFeatureUsageSchema.statics.getPeriodKey = function (limitType, renewalDate = null) {
    const now = new Date();

    switch (limitType) {
        case 'DAILY':
            return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
        case 'MONTHLY':
            return now.toISOString().slice(0, 7); // "YYYY-MM"
        case 'TOTAL':
        case 'NONE':
        default:
            if (renewalDate) {
                const dateObj = renewalDate instanceof Date ? renewalDate : new Date(renewalDate);
                if (!isNaN(dateObj.getTime())) {
                    return `CYCLE-${dateObj.toISOString().slice(0, 10)}`;
                }
            }
            return 'TOTAL';
    }
};

/**
 * Get current usage for a license instance and feature
 */
licenseInstanceFeatureUsageSchema.statics.getCurrentUsage = async function (
    licenseInstanceId,
    featureCode,
    limitType,
    renewalDate = null
) {
    const periodKey = this.getPeriodKey(limitType, renewalDate);
    const featureCodeUpper = featureCode.toUpperCase();

    const record = await this.findOne({
        license_instance_id: licenseInstanceId,
        feature_code: featureCodeUpper,
        period_key: periodKey,
    }).lean();

    let used = record?.used_count || 0;

    // Safety check across any other matching records for current period/total
    if (limitType === 'TOTAL') {
        // Also check if there's a legacy 'TOTAL' record if cycle key was used
        if (periodKey !== 'TOTAL') {
            const fallbackRecord = await this.findOne({
                license_instance_id: licenseInstanceId,
                feature_code: featureCodeUpper,
                period_key: 'TOTAL',
            }).lean();
            if (fallbackRecord && fallbackRecord.used_count > used) {
                used = fallbackRecord.used_count;
            }
        }
    }

    return used;
};

/**
 * Consume feature usage on a license instance seat
 */
licenseInstanceFeatureUsageSchema.statics.consumeUsage = async function (
    licenseInstanceId,
    featureCode,
    limitType,
    amount = 1,
    userId = null,
    renewalDate = null,
    session = null
) {
    const periodKey = this.getPeriodKey(limitType, renewalDate);
    const featureCodeUpper = featureCode.toUpperCase();

    const query = {
        license_instance_id: licenseInstanceId,
        feature_code: featureCodeUpper,
        period_key: periodKey,
    };

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            const existingRecord = session
                ? await this.findOne(query).session(session)
                : await this.findOne(query);

            if (existingRecord) {
                existingRecord.used_count += amount;
                existingRecord.last_used_at = new Date();
                if (userId) existingRecord.last_used_by = userId;
                return await existingRecord.save(session ? { session } : {});
            }

            // Create new record
            const createData = {
                license_instance_id: licenseInstanceId,
                feature_code: featureCodeUpper,
                period_key: periodKey,
                limit_type: limitType,
                used_count: amount,
                last_used_at: new Date(),
                last_used_by: userId,
            };

            if (session) {
                const created = await this.create([createData], { session });
                return created[0];
            } else {
                return await this.create(createData);
            }
        } catch (err) {
            if (err.code === 11000 && attempts < maxAttempts) {
                continue; // Retry on race condition duplicate key
            }
            throw err;
        }
    }
};

/**
 * Get batch current usage for a license instance across all features
 */
licenseInstanceFeatureUsageSchema.statics.getInstanceCurrentUsage = async function (
    licenseInstanceId,
    featureMappings,
    renewalDate = null
) {
    const usageData = {};

    // Fetch all records for this instance
    const allRecords = await this.find({
        license_instance_id: licenseInstanceId,
    }).lean();

    // Map by feature_code and period_key
    const recordMap = new Map();
    for (const r of allRecords) {
        const key = `${r.feature_code}:${r.period_key}`;
        recordMap.set(key, r);
    }

    for (const mapping of featureMappings) {
        const limitType = mapping.limit_type || 'MONTHLY';
        const periodKey = this.getPeriodKey(limitType, renewalDate);
        const featureKey = `${mapping.feature_code}:${periodKey}`;

        let record = recordMap.get(featureKey);
        let used = record?.used_count || 0;

        if (limitType === 'TOTAL' && !record && periodKey !== 'TOTAL') {
            const fallbackRecord = recordMap.get(`${mapping.feature_code}:TOTAL`);
            if (fallbackRecord) used = fallbackRecord.used_count || 0;
        }

        const limit = mapping.usage_limit;
        const isUnlimited = limit === -1;
        const remaining = isUnlimited ? -1 : Math.max(0, limit - used);
        const percentage = isUnlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));

        usageData[mapping.feature_code] = {
            used,
            limit,
            remaining,
            isUnlimited,
            percentage,
            limitType,
            periodKey,
        };
    }

    return usageData;
};

export const LicenseInstanceFeatureUsage = mongoose.model(
    'LicenseInstanceFeatureUsage',
    licenseInstanceFeatureUsageSchema
);

export default LicenseInstanceFeatureUsage;
