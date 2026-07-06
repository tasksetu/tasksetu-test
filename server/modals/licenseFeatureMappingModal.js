import mongoose from 'mongoose';

/**
 * License Feature Mapping Schema
 * Maps which features are available in which license tiers with usage limits
 */
const licenseFeatureMappingSchema = new mongoose.Schema(
  {
    license_code: {
      type: String,
      required: true,
      uppercase: true,
      ref: 'License',
      index: true,
    },
    feature_code: {
      type: String,
      required: true,
      uppercase: true,
      ref: 'Feature',
      index: true,
    },
    usage_limit: {
      type: Number,
      required: true,
      default: -1, // -1 means unlimited
    },
    is_enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    limit_type: {
      type: String,
      enum: ['MONTHLY', 'DAILY', 'TOTAL', 'CONCURRENT', 'NONE'],
      default: 'MONTHLY',
    },
    custom_config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Compound unique index to prevent duplicate mappings
licenseFeatureMappingSchema.index(
  { license_code: 1, feature_code: 1 },
  { unique: true }
);

// Compound indexes for queries
licenseFeatureMappingSchema.index({ license_code: 1, is_enabled: 1 });
licenseFeatureMappingSchema.index({ feature_code: 1, is_enabled: 1 });

// Methods
licenseFeatureMappingSchema.methods.isUnlimited = function () {
  return this.usage_limit === -1;
};

licenseFeatureMappingSchema.methods.hasLimit = function () {
  return this.usage_limit > 0;
};

// Statics
licenseFeatureMappingSchema.statics.getFeaturesByLicense = async function (
  licenseCode
) {
  // Get all feature mappings for this license
  const mappings = await this.find({
    license_code: licenseCode,
    is_enabled: true,
  }).lean();

  // Get the feature codes from mappings
  const featureCodes = mappings.map(m => m.feature_code);

  // Fetch the actual Feature documents by feature_code field (not _id)
  const Feature = mongoose.model('Feature');
  const features = await Feature.find({
    feature_code: { $in: featureCodes },
    is_active: true,
  }).lean();

  // Create a lookup map for features
  const featureMap = {};
  features.forEach(f => {
    featureMap[f.feature_code] = f;
  });

  // Combine mapping data with feature data
  return mappings.map(mapping => ({
    ...mapping,
    feature: featureMap[mapping.feature_code] || null,
  }));
};

licenseFeatureMappingSchema.statics.checkFeatureAccess = async function (
  licenseCode,
  featureCode
) {
  const mapping = await this.findOne({
    license_code: licenseCode,
    feature_code: featureCode,
    is_enabled: true,
  });

  const usageLimit = mapping?.usage_limit || 0;
  const isUnlimited = usageLimit === -1;
  const hasLimit = usageLimit > 0; // true if limit is a positive number

  return {
    hasAccess: !!mapping,
    hasLimit: hasLimit,
    usageLimit: usageLimit,
    limitType: mapping?.limit_type || 'NONE',
    isUnlimited: isUnlimited,
  };
};

export const LicenseFeatureMapping = mongoose.model(
  'LicenseFeatureMapping',
  licenseFeatureMappingSchema
);
