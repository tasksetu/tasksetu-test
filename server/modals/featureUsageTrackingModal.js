import mongoose from 'mongoose';

/**
 * Feature Usage Tracking Schema
 * Tracks actual usage of features per organization
 */
const featureUsageTrackingSchema = new mongoose.Schema(
  {
    organization_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    feature_code: {
      type: String,
      required: true,
      uppercase: true,
      ref: 'Feature',
      index: true,
    },
    usage_period: {
      type: String,
      required: true,
      enum: ['DAILY', 'MONTHLY', 'TOTAL', 'CONCURRENT'],
      default: 'MONTHLY',
    },
    period_start: {
      type: Date,
      required: true,
    },
    period_end: {
      type: Date,
      default: null,
    },
    usage_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    usage_limit: {
      type: Number,
      default: -1, // -1 = unlimited
    },
    peak_concurrent_usage: {
      type: Number,
      default: 0,
      min: 0,
    },
    current_concurrent_usage: {
      type: Number,
      default: 0,
      min: 0,
    },
    last_used_at: {
      type: Date,
      default: null,
    },
    limit_exceeded_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    last_limit_exceeded_at: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Compound indexes
// Compound indexes
featureUsageTrackingSchema.index({ organization_id: 1, feature_code: 1, period_start: 1 }, { unique: true, partialFilterExpression: { organization_id: { $exists: true } } });
featureUsageTrackingSchema.index({ user_id: 1, feature_code: 1, period_start: 1 }, { unique: true, partialFilterExpression: { user_id: { $exists: true } } });
featureUsageTrackingSchema.index({ organization_id: 1, usage_period: 1 });
featureUsageTrackingSchema.index({ user_id: 1, usage_period: 1 });
featureUsageTrackingSchema.index({ feature_code: 1, usage_period: 1 });
featureUsageTrackingSchema.index({ period_end: 1 });

// Methods
featureUsageTrackingSchema.methods.isLimitExceeded = function () {
  if (this.usage_limit === -1) return false;
  return this.usage_count >= this.usage_limit;
};

featureUsageTrackingSchema.methods.hasRemainingUsage = function () {
  if (this.usage_limit === -1) return true;
  return this.usage_count < this.usage_limit;
};

featureUsageTrackingSchema.methods.getRemainingUsage = function () {
  if (this.usage_limit === -1) return -1;
  return Math.max(0, this.usage_limit - this.usage_count);
};

featureUsageTrackingSchema.methods.getUsagePercentage = function () {
  if (this.usage_limit === -1) return 0;
  if (this.usage_limit === 0) return 100;
  return Math.min(100, (this.usage_count / this.usage_limit) * 100);
};

featureUsageTrackingSchema.methods.incrementUsage = async function (amount = 1) {
  this.usage_count += amount;
  this.last_used_at = new Date();

  if (this.isLimitExceeded()) {
    this.limit_exceeded_count += 1;
    this.last_limit_exceeded_at = new Date();
  }

  return this.save();
};

featureUsageTrackingSchema.methods.incrementConcurrent = async function () {
  this.current_concurrent_usage += 1;
  this.peak_concurrent_usage = Math.max(this.peak_concurrent_usage, this.current_concurrent_usage);
  this.last_used_at = new Date();

  if (this.usage_limit !== -1 && this.current_concurrent_usage > this.usage_limit) {
    this.limit_exceeded_count += 1;
    this.last_limit_exceeded_at = new Date();
  }

  return this.save();
};

featureUsageTrackingSchema.methods.decrementConcurrent = async function () {
  this.current_concurrent_usage = Math.max(0, this.current_concurrent_usage - 1);
  return this.save();
};

// Statics
featureUsageTrackingSchema.statics.getCurrentPeriod = function (usagePeriod) {
  const now = new Date();
  const start = new Date(now);
  let end = null;

  switch (usagePeriod) {
    case 'DAILY':
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      break;
    case 'MONTHLY':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      break;
    case 'TOTAL':
    case 'NONE':
      // ✅ FIXED: NONE (unlimited) uses same period as TOTAL - single period forever
      start.setFullYear(2020, 0, 1); // Arbitrary start date
      start.setHours(0, 0, 0, 0); // ✅ FIXED: Reset time to midnight to ensure consistent period_start
      end = null;
      break;
    case 'CONCURRENT':
      start.setHours(0, 0, 0, 0);
      end = null;
      break;
    default:
      // ✅ FIXED: Default to TOTAL-like behavior for unknown types
      start.setFullYear(2020, 0, 1);
      start.setHours(0, 0, 0, 0);
      end = null;
      break;
  }

  return { start, end };
};

featureUsageTrackingSchema.statics.trackUsage = async function (
  entityId,
  featureCode,
  usagePeriod,
  usageLimit,
  incrementAmount = 1,
  entityType = 'company' // 'company' or 'individual'
) {
  const { start, end } = this.getCurrentPeriod(usagePeriod);

  const query = {
    feature_code: featureCode,
    period_start: start,
  };

  if (entityType === 'individual') {
    query.user_id = entityId;
  } else {
    query.organization_id = entityId;
  }

  let tracking = await this.findOne(query);

  if (!tracking) {
    const createData = {
      feature_code: featureCode,
      usage_period: usagePeriod,
      period_start: start,
      period_end: end,
      usage_limit: usageLimit,
      usage_count: 0,
    };

    if (entityType === 'individual') {
      createData.user_id = entityId;
    } else {
      createData.organization_id = entityId;
    }

    tracking = await this.create(createData);
  }

  await tracking.incrementUsage(incrementAmount);
  return tracking;
};

featureUsageTrackingSchema.statics.checkUsageLimit = async function (
  entityId,
  featureCode,
  usagePeriod,
  entityType = 'company'
) {
  const { start } = this.getCurrentPeriod(usagePeriod);

  const query = {
    feature_code: featureCode,
    period_start: start,
  };

  if (entityType === 'individual') {
    query.user_id = entityId;
  } else {
    query.organization_id = entityId;
  }

  const tracking = await this.findOne(query);

  if (!tracking) {
    return {
      hasAccess: true,
      usageCount: 0,
      usageLimit: -1,
      remaining: -1,
      isUnlimited: true,
    };
  }

  return {
    hasAccess: tracking.hasRemainingUsage(),
    usageCount: tracking.usage_count,
    usageLimit: tracking.usage_limit,
    remaining: tracking.getRemainingUsage(),
    isUnlimited: tracking.usage_limit === -1,
    percentage: tracking.getUsagePercentage(),
  };
};

featureUsageTrackingSchema.statics.getEntityUsage = async function (
  entityId,
  usagePeriod = 'MONTHLY',
  entityType = 'company'
) {
  const { start } = this.getCurrentPeriod(usagePeriod);

  const query = {
    usage_period: usagePeriod,
    period_start: start,
  };

  if (entityType === 'individual') {
    query.user_id = entityId;
  } else {
    query.organization_id = entityId;
  }

  const usageRecords = await this.find(query);

  return usageRecords.map((record) => ({
    feature_code: record.feature_code,
    usage_count: record.usage_count,
    usage_limit: record.usage_limit,
    remaining: record.getRemainingUsage(),
    percentage: record.getUsagePercentage(),
    isLimitExceeded: record.isLimitExceeded(),
    last_used_at: record.last_used_at,
  }));
};

featureUsageTrackingSchema.statics.resetExpiredPeriods = async function () {
  const now = new Date();

  const expiredRecords = await this.updateMany(
    {
      period_end: { $lte: now, $ne: null },
      usage_period: { $in: ['DAILY', 'MONTHLY'] },
    },
    {
      $set: {
        usage_count: 0,
        current_concurrent_usage: 0,
        limit_exceeded_count: 0,
      },
    }
  );

  return expiredRecords.modifiedCount;
};

export const FeatureUsageTracking = mongoose.model(
  'FeatureUsageTracking',
  featureUsageTrackingSchema
);
