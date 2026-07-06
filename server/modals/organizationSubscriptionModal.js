import mongoose from 'mongoose';

/**
 * Organization Subscription Schema
 * Tracks current subscription status for each organization
 */
const organizationSubscriptionSchema = new mongoose.Schema(
  {
    organization_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    license_code: {
      type: String,
      required: true,
      uppercase: true,
      ref: 'License',
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED', 'SUSPENDED'],
      default: 'TRIAL',
      index: true,
    },
    trial_start_date: {
      type: Date,
      default: null,
    },
    trial_end_date: {
      type: Date,
      default: null,
    },
    subscription_start_date: {
      type: Date,
      default: null,
    },
    subscription_end_date: {
      type: Date,
      default: null,
    },
    auto_renew: {
      type: Boolean,
      default: true,
    },
    billing_cycle: {
      type: String,
      enum: ['MONTHLY', 'YEARLY', 'NONE'],
      default: 'MONTHLY',
    },
    seats_purchased: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },
    seats_used: {
      type: Number,
      default: 0,
      min: 0,
    },
    seats_occupied: {
      type: Number,
      default: 0,
      min: 0,
      comment: 'Currently assigned seats to active users'
    },
    seats_available: {
      type: Number,
      default: 10,
      min: 0,
      comment: 'Available seats for assignment'
    },
    seat_history: [{
      action: { type: String, enum: ['assigned', 'released', 'transferred'], required: true },
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For transfers
      to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For transfers
      performed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      timestamp: { type: Date, default: Date.now },
      reason: { type: String },
      seat_number: { type: Number } // Track specific seat number
    }],
    payment_method: {
      type: String,
      enum: ['CREDIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'INVOICE', 'NONE'],
      default: 'NONE',
    },
    last_payment_date: {
      type: Date,
      default: null,
    },
    next_billing_date: {
      type: Date,
      default: null,
    },
    total_amount_paid: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount_code: {
      type: String,
      default: null,
    },
    discount_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    notes: {
      type: String,
      default: null,
    },
    cancelled_at: {
      type: Date,
      default: null,
    },
    cancellation_reason: {
      type: String,
      default: null,
    },
    // Super Admin Override Fields
    override_reason: {
      type: String,
      default: null,
    },
    overridden_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    overridden_at: {
      type: Date,
      default: null,
    },
    // Trial Extension Fields
    trial_extended_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    trial_extension_reason: {
      type: String,
      default: null,
    },
    trial_extended_at: {
      type: Date,
      default: null,
    },
    // Suspension Fields
    suspended_at: {
      type: Date,
      default: null,
    },
    suspended_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    suspension_reason: {
      type: String,
      default: null,
    },
    suspend_until: {
      type: Date,
      default: null,
    },
    reactivated_at: {
      type: Date,
      default: null,
    },
    reactivated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reactivation_reason: {
      type: String,
      default: null,
    },
    // Feature Overrides
    feature_overrides: [{
      feature_code: { type: String, required: true },
      enabled: { type: Boolean, required: true },
      reason: { type: String },
      overridden_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      overridden_at: { type: Date, default: Date.now }
    }],
    // Additional fields for compatibility
    start_date: {
      type: Date,
      default: null,
    },
    expiry_date: {
      type: Date,
      default: null,
    },
    is_trial: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Indexes
organizationSubscriptionSchema.index({ organization_id: 1, status: 1 });
organizationSubscriptionSchema.index({ license_code: 1, status: 1 });
organizationSubscriptionSchema.index({ subscription_end_date: 1 });
organizationSubscriptionSchema.index({ trial_end_date: 1 });

// Methods
organizationSubscriptionSchema.methods.isTrialExpired = function () {
  if (!this.trial_end_date) return false;
  return new Date() > this.trial_end_date;
};

organizationSubscriptionSchema.methods.isSubscriptionExpired = function () {
  if (!this.subscription_end_date) return false;
  return new Date() > this.subscription_end_date;
};

organizationSubscriptionSchema.methods.getDaysRemaining = function () {
  const endDate = this.status === 'TRIAL' ? this.trial_end_date : this.subscription_end_date;
  if (!endDate) return 0;
  
  const now = new Date();
  const diff = endDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

organizationSubscriptionSchema.methods.hasAvailableSeats = function () {
  return this.seats_used < this.seats_purchased;
};

organizationSubscriptionSchema.methods.getAvailableSeats = function () {
  return Math.max(0, this.seats_purchased - this.seats_used);
};

// Statics
organizationSubscriptionSchema.statics.initializeTrial = async function (
  organizationId
) {
  // ✅ SINGLE SOURCE OF TRUTH: Fetch license definition
  const { License } = await import('./licenseModal.js');
  const exploreLicense = await License.findOne({ license_code: 'EXPLORE' });

  console.log(`ℹ/ [SUBSCRIPTION MODAL] Initializing permanently active free plan for organization ${organizationId}`);

  return this.create({
    organization_id: organizationId,
    license_code: 'EXPLORE',
    status: 'ACTIVE',
    trial_start_date: null,
    trial_end_date: null,
    subscription_start_date: new Date(),
    subscription_end_date: null,
    seats_purchased: exploreLicense?.max_users || 10,
    seats_used: 1, // Primary admin
  });
};

organizationSubscriptionSchema.statics.checkAndExpireTrials = async function () {
  const now = new Date();
  
  const expiredTrials = await this.find({
    status: 'TRIAL',
    license_code: { $ne: 'EXPLORE' },
    trial_end_date: { $lte: now },
  });

  for (const subscription of expiredTrials) {
    subscription.status = 'EXPIRED';
    subscription.license_code = 'EXPIRED';
    await subscription.save();
  }

  return expiredTrials.length;
};

export const OrganizationSubscription = mongoose.model(
  'OrganizationSubscription',
  organizationSubscriptionSchema
);
