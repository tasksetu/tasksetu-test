import mongoose from 'mongoose';

const organizationLicensePurchaseSchema = new mongoose.Schema({
  organization_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  license_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'License',
    required: true
  },
  license_code: {
    type: String,
    required: true
  },
  license_name: {
    type: String,
    required: true
  },
  // 🚫 DEPRECATED: Seat-based fields (being replaced by LicenseInstance model)
  // Keep these for backward compatibility during migration period
  seats_purchased: {
    type: Number,
    required: true,
    min: 1,
    deprecated: true,
    comment: 'DEPRECATED: Use LicenseInstance count instead'
  },
  seats_used: {
    type: Number,
    default: 0,
    min: 0,
    deprecated: true,
    comment: 'DEPRECATED: Use LicenseInstance.status=ASSIGNED count instead'
  },
  billing_cycle: {
    type: String,
    enum: ['MONTHLY', 'YEARLY'],
    default: 'MONTHLY'
  },
  price_per_seat: {
    type: Number,
    required: true
  },
  total_price: {
    type: Number,
    required: true
  },
  purchase_date: {
    type: Date,
    default: Date.now
  },
  renewal_date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
    default: 'ACTIVE'
  },
  auto_renew: {
    type: Boolean,
    default: true
  },
  payment_info: {
    transaction_id: String,
    payment_method: String,
    payment_status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'COMPLETED'
    }
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index for efficient queries
organizationLicensePurchaseSchema.index({ organization_id: 1, license_code: 1 });
organizationLicensePurchaseSchema.index({ organization_id: 1, status: 1 });

// 🚫 DEPRECATED: Virtual and methods for seat-based system (kept for backward compatibility)
// Virtual for available seats
organizationLicensePurchaseSchema.virtual('seats_available').get(function () {
  return this.seats_purchased - this.seats_used;
});

// Method to check if seats are available (DEPRECATED)
organizationLicensePurchaseSchema.methods.hasAvailableSeats = function (requiredSeats = 1) {
  return (this.seats_purchased - this.seats_used) >= requiredSeats;
};

// Method to allocate a seat (DEPRECATED)
organizationLicensePurchaseSchema.methods.allocateSeat = async function () {
  if (!this.hasAvailableSeats()) {
    throw new Error('No available seats in this license purchase');
  }
  this.seats_used += 1;
  await this.save();
  return this;
};

// Method to release a seat (DEPRECATED)
organizationLicensePurchaseSchema.methods.releaseSeat = async function () {
  if (this.seats_used <= 0) {
    throw new Error('No seats to release');
  }
  this.seats_used -= 1;
  await this.save();
  return this;
};

// Static method to get organization's license pool (DEPRECATED)
organizationLicensePurchaseSchema.statics.getOrganizationLicensePool = async function (organizationId) {
  return this.aggregate([
    {
      $match: {
        organization_id: new mongoose.Types.ObjectId(organizationId),
        status: 'ACTIVE'
      }
    },
    {
      $group: {
        _id: '$license_code',
        license_name: { $first: '$license_name' },
        total_seats_purchased: { $sum: '$seats_purchased' },
        total_seats_used: { $sum: '$seats_used' },
        purchases: {
          $push: {
            purchase_id: '$_id',
            seats_purchased: '$seats_purchased',
            seats_used: '$seats_used',
            billing_cycle: '$billing_cycle',
            renewal_date: '$renewal_date'
          }
        }
      }
    },
    {
      $project: {
        license_code: '$_id',
        license_name: 1,
        total_seats_purchased: 1,
        total_seats_used: 1,
        total_seats_available: {
          $subtract: ['$total_seats_purchased', '$total_seats_used']
        },
        purchases: 1,
        _id: 0
      }
    },
    {
      $sort: { license_code: 1 }
    }
  ]);
};

// Static method to find available purchase for allocation (DEPRECATED)
organizationLicensePurchaseSchema.statics.findAvailablePurchase = async function (organizationId, licenseCode) {
  return this.findOne({
    organization_id: organizationId,
    license_code: licenseCode,
    status: 'ACTIVE',
    $expr: { $lt: ['$seats_used', '$seats_purchased'] }
  }).sort({ purchase_date: 1 }); // Allocate from oldest purchase first
};

const OrganizationLicensePurchase = mongoose.model('OrganizationLicensePurchase', organizationLicensePurchaseSchema, 'organizationlicensepurchases');

export { OrganizationLicensePurchase };
export default OrganizationLicensePurchase;
