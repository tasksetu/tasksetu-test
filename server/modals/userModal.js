import mongoose from "mongoose";
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
      required: function () {
        return this.status === "active";
      },
    },
    lastName: {
      type: String,
      trim: true,
      required: function () {
        return this.status === "active";
      },
    },
    profileImageUrl: String,
    phone: {
      type: String,
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerificationOtp: {
      type: String,
      default: null,
    },
    phoneVerificationOtpExpires: {
      type: Date,
      default: null,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    passwordHash: {
      type: String,
      required: function () {
        return this.status === "active";
      },
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    organization_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    role: {
      type: [String],
      enum: ["super_admin", "org_admin", "manager", "individual", "employee"],
      default: ["employee"],
      required: true,
    },
    isPrimaryAdmin: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "invited", "active", "inactive", "suspended"],
      default: "pending",
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    department: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    // Phase I RBAC: Manager-Employee Hierarchy
    subordinates: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      comment: 'List of employee user IDs under this manager for Team Tasks functionality'
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      comment: 'Reference to manager (reverse relationship for queries)'
    },
    // 🆕 NEW ATOMIC LICENSING MODEL: User-License Instance Assignment
    license_instance_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LicenseInstance',
      default: null,
      comment: '🔑 Reference to assigned LicenseInstance (NULL = no license assigned)'
    },

    // 🆕 USER-LEVEL LICENSE FIELDS (New model: each user has own license)
    license_expiry: {
      type: Date,
      default: null,
       comment: 'Expiry date for user\'s license (NULL = no expiry / free plan)'
    },

    // 🆕 PENDING LICENSE: Stores a scheduled license change (e.g., downgrade that activates after current plan expires)
    pending_license: {
      license_code: { type: String, uppercase: true, default: null },
      billing_cycle: { type: String, enum: ['MONTHLY', 'YEARLY', null], default: null },
      scheduled_start_date: { type: Date, default: null },
      scheduled_end_date: { type: Date, default: null },
      payment_id: { type: String, default: null },
      is_downgrade: { type: Boolean, default: false },
      created_at: { type: Date, default: null }
    },


    // 🚫 DEPRECATED: Old licensing fields (keep for backward compatibility during migration)
    license_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyLicense',
      default: null,
      comment: 'DEPRECATED: Use license_instance_id instead',
    },
    licenseId: {
      type: String,
      trim: true,
      deprecated: true,
      comment: 'DEPRECATED: Use license_instance_id instead',
    },
    license_code: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      ref: 'License',
      deprecated: true,
      comment: 'DEPRECATED: License info now tracked via license_instance_id',
    },
    account_type: {
      type: String,
      enum: ['individual', 'company'],
      default: 'individual',
      comment: 'DEPRECATED: Account type - being phased out',
    },
    // Seat Management Fields (DEPRECATED - being replaced by atomic license instances)
    seat_assigned: {
      type: Boolean,
      default: false,
      deprecated: true,
      comment: 'DEPRECATED: Use license_instance_id instead'
    },
    seat_number: {
      type: Number,
      default: null,
      deprecated: true,
      comment: 'DEPRECATED: Seat numbers no longer used in atomic model'
    },
    seat_assigned_at: {
      type: Date,
      default: null,
      deprecated: true,
      comment: 'DEPRECATED: Use LicenseInstance.assigned_at'
    },
    seat_released_at: {
      type: Date,
      default: null,
      deprecated: true,
      comment: 'DEPRECATED: Use LicenseInstance.released_at'
    },
    // Multi-license assignment (DEPRECATED)
    assigned_license: {
      license_code: {
        type: String,
        uppercase: true,
        trim: true
      },
      purchase_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationLicensePurchase'
      },
      assigned_date: {
        type: Date
      }
    },
    license_limits: {
      max_projects_per_user: { type: Number, default: 0 },
      max_tasks_per_user: { type: Number, default: 0 },
      max_storage_per_user_mb: { type: Number, default: 0 },
      max_collaborators_per_user: { type: Number, default: 0 },
      features_enabled: [String]
    },
    usage_stats: {
      projects_created: { type: Number, default: 0 },
      tasks_created: { type: Number, default: 0 },
      storage_used_mb: { type: Number, default: 0 },
      last_activity: { type: Date }
    },
    // End Seat Management Fields
    inviteToken: String,
    inviteTokenExpiry: Date,
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    invitedAt: Date,
    lastLoginAt: Date,
    preferences: {
      type: Object,
      default: {},
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },

    assignedTasks: {
      type: Number,
      default: 0,
    },
    completedTasks: {
      type: Number,
      default: 0,
    },
    // Legacy fields for backward compatibility
    roles: {
      type: [String],
      default: [],
    },

    // Google Calendar integration
    googleCalendarTokens: {
      access_token: String,
      refresh_token: String,
      scope: String,
      token_type: String,
      expiry_date: Number,
    },
    googleCalendarConnected: {
      type: Boolean,
      default: false,
    },
    googleCalendarEmail: String,
  },
  {
    timestamps: true,
  }
);
userSchema.index({ organization_id: 1 });
userSchema.index({ license_id: 1 });
userSchema.index({ license_instance_id: 1 }); // 🆕 New atomic license index

// Virtual to get license_code from assigned LicenseInstance
userSchema.virtual('assignedLicenseInstance', {
  ref: 'LicenseInstance',
  localField: 'license_instance_id',
  foreignField: '_id',
  justOne: true
});

// Virtual to get license_code from assigned CompanyLicense (DEPRECATED)
userSchema.virtual('assignedLicense', {
  ref: 'CompanyLicense',
  localField: 'license_id',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// 🆕 Static method to get user with NEW license instance populated
userSchema.statics.findWithLicenseInstance = function (query) {
  return this.findOne(query).populate({
    path: 'license_instance_id',
    select: 'license_code status assigned_at renewal_date billing_cycle'
  });
};

userSchema.statics.findManyWithLicenseInstance = function (query) {
  return this.find(query).populate({
    path: 'license_instance_id',
    select: 'license_code status assigned_at renewal_date billing_cycle'
  });
};

// DEPRECATED: Old static methods (keep for backward compatibility)
// Static method to get user with license info populated
userSchema.statics.findWithLicense = function (query) {
  return this.findOne(query).populate({
    path: 'license_id',
    select: 'license_type license_id status assigned_at'
  });
};

userSchema.statics.findManyWithLicense = function (query) {
  return this.find(query).populate({
    path: 'license_id',
    select: 'license_type license_id status assigned_at'
  });
};

// User Schema
export const User = mongoose.model("User", userSchema);
