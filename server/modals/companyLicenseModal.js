import mongoose from "mongoose";

/**
 * 🔹 COMPANY LICENSE POOL MODEL
 * 
 * Represents individual license instances owned by a company.
 * Each license is an atomic unit that can be assigned to exactly one user.
 * 
 * Example:
 * If company purchases:
 * - PLAN × 4
 * - EXECUTE × 7
 * - OPTIMIZE × 5
 * 
 * This creates 16 separate license documents (not counters).
 */
const companyLicenseSchema = new mongoose.Schema(
  {
    // License identification
    license_id: {
      type: String,
      required: true,
      unique: true,
      comment: 'Unique identifier for this license instance (e.g., "L-ORG123-PLAN-001")',
    },

    // Ownership
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
      comment: 'Company that owns this license',
    },

    // License type
    license_type: {
      type: String,
      required: true,
      uppercase: true,
      enum: ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'],
      comment: 'Type of license (determines features & limits)',
    },

    // Assignment status
    status: {
      type: String,
      required: true,
      enum: ['AVAILABLE', 'ASSIGNED', 'SUSPENDED', 'EXPIRED'],
      default: 'AVAILABLE',
      index: true,
      comment: 'Current status of this license unit',
    },

    // User assignment (if assigned)
    assigned_to_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
      comment: 'User who currently has this license assigned (null if AVAILABLE)',
    },

    assigned_at: {
      type: Date,
      default: null,
      comment: 'When this license was assigned to current user',
    },

    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      comment: 'Admin who assigned this license',
    },

    // Purchase information
    purchase_batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrganizationLicensePurchase",
      comment: 'Reference to the bulk purchase order',
    },

    purchased_at: {
      type: Date,
      required: true,
      default: Date.now,
      comment: 'When this license was purchased',
    },

    // Expiry information
    expires_at: {
      type: Date,
      default: null,
      comment: 'License expiry date (null for perpetual licenses)',
    },

    // History tracking
    assignment_history: [
      {
        action: {
          type: String,
          enum: ['ASSIGNED', 'RELEASED', 'TRANSFERRED', 'SUSPENDED', 'REACTIVATED'],
          required: true,
        },
        user_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        performed_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
        },
      },
    ],

    // Metadata
    notes: {
      type: String,
      maxlength: 500,
      comment: 'Admin notes about this license',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
companyLicenseSchema.index({ company_id: 1, license_type: 1 });
companyLicenseSchema.index({ company_id: 1, status: 1 });
companyLicenseSchema.index({ company_id: 1, license_type: 1, status: 1 });

// Virtual for checking if license is available
companyLicenseSchema.virtual('isAvailable').get(function () {
  return this.status === 'AVAILABLE' && this.assigned_to_user_id === null;
});

// Static method to get available licenses for a company
companyLicenseSchema.statics.getAvailableLicenses = function (companyId, licenseType = null) {
  const query = {
    company_id: companyId,
    status: 'AVAILABLE',
    assigned_to_user_id: null,
  };
  
  if (licenseType) {
    query.license_type = licenseType.toUpperCase();
  }
  
  return this.find(query);
};

// Static method to get license inventory summary
companyLicenseSchema.statics.getInventorySummary = async function (companyId) {
  const result = await this.aggregate([
    { $match: { company_id: new mongoose.Types.ObjectId(companyId) } },
    {
      $group: {
        _id: '$license_type',
        total: { $sum: 1 },
        available: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'AVAILABLE'] }, { $eq: ['$assigned_to_user_id', null] }] },
              1,
              0,
            ],
          },
        },
        assigned: {
          $sum: {
            $cond: [{ $eq: ['$status', 'ASSIGNED'] }, 1, 0],
          },
        },
        suspended: {
          $sum: {
            $cond: [{ $eq: ['$status', 'SUSPENDED'] }, 1, 0],
          },
        },
        expired: {
          $sum: {
            $cond: [{ $eq: ['$status', 'EXPIRED'] }, 1, 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Format the result
  const inventory = {
    EXPLORE: { total: 0, available: 0, assigned: 0, suspended: 0, expired: 0 },
    PLAN: { total: 0, available: 0, assigned: 0, suspended: 0, expired: 0 },
    EXECUTE: { total: 0, available: 0, assigned: 0, suspended: 0, expired: 0 },
    OPTIMIZE: { total: 0, available: 0, assigned: 0, suspended: 0, expired: 0 },
  };

  result.forEach((item) => {
    if (inventory[item._id]) {
      inventory[item._id] = {
        total: item.total,
        available: item.available,
        assigned: item.assigned,
        suspended: item.suspended,
        expired: item.expired,
      };
    }
  });

  return inventory;
};

// Method to assign license to a user
companyLicenseSchema.methods.assignToUser = function (userId, assignedBy) {
  if (this.status !== 'AVAILABLE' || this.assigned_to_user_id !== null) {
    throw new Error('License is not available for assignment');
  }

  this.status = 'ASSIGNED';
  this.assigned_to_user_id = userId;
  this.assigned_at = new Date();
  this.assigned_by = assignedBy;

  this.assignment_history.push({
    action: 'ASSIGNED',
    user_id: userId,
    performed_by: assignedBy,
    timestamp: new Date(),
  });

  return this.save();
};

// Method to release license from user
companyLicenseSchema.methods.releaseFromUser = function (performedBy, reason = null) {
  if (this.status !== 'ASSIGNED' || this.assigned_to_user_id === null) {
    throw new Error('License is not currently assigned');
  }

  const previousUserId = this.assigned_to_user_id;

  this.status = 'AVAILABLE';
  this.assigned_to_user_id = null;
  this.assigned_at = null;
  this.assigned_by = null;

  this.assignment_history.push({
    action: 'RELEASED',
    user_id: previousUserId,
    performed_by: performedBy,
    timestamp: new Date(),
    reason: reason,
  });

  return this.save();
};

export const CompanyLicense = mongoose.model("CompanyLicense", companyLicenseSchema);
