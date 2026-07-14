import mongoose from 'mongoose';

/**
 * License Schema
 * Defines the different license tiers available in TaskSetu
 */
const licenseSchema = new mongoose.Schema(
  {
    license_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      enum: ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE', 'EXPIRED'],
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    billing_cycle: {
      type: String,
      required: true,
      enum: ['TRIAL', 'MONTHLY', 'YEARLY', 'NONE'],
      default: 'MONTHLY',
    },
    price_monthly: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    price_yearly: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    max_users: {
      type: Number,
      required: true,
      default: -1, // -1 means unlimited
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    display_order: {
      type: Number,
      default: 0,
    },
    features_summary: {
      type: [String],
      default: [],
    },
    is_popular: {
      type: Boolean,
      default: false,
    },
    grace_period_days: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Number of grace days after license expiry during which renewal starts from original expiry date',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Indexes for performance
licenseSchema.index({ license_code: 1, is_active: 1 });
licenseSchema.index({ display_order: 1 });

// Methods
licenseSchema.methods.getDiscountedYearlyPrice = function () {
  return this.price_yearly || this.price_monthly * 12 * 0.8; // 20% discount
};

licenseSchema.methods.isUnlimitedUsers = function () {
  return this.max_users === -1;
};

export const License = mongoose.model('License', licenseSchema);
