import mongoose from 'mongoose';

/**
 * Feature Schema
 * Master table defining all features available in TaskSetu
 */
const featureSchema = new mongoose.Schema(
  {
    feature_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
      trim: true,
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
    category: {
      type: String,
      required: true,
      enum: ['CORE', 'ADVANCED', 'PREMIUM', 'ENTERPRISE'],
      default: 'CORE',
      index: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    view: {
      type: Boolean,
      default: true,
      index: true,
    },
    icon: {
      type: String,
      default: null,
    },
    display_order: {
      type: Number,
      default: 0,
    },
    documentation_url: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Indexes
featureSchema.index({ feature_code: 1, is_active: 1 });
featureSchema.index({ category: 1, display_order: 1 });

// Static method to get features by category
featureSchema.statics.getByCategory = function (category) {
  return this.find({ category, is_active: true }).sort({ display_order: 1 });
};

export const Feature = mongoose.model('Feature', featureSchema);
