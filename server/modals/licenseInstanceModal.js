import mongoose from 'mongoose';

/**
 * LicenseInstance Model
 * 
 * Core concept: Each document represents ONE purchasable license unit
 * 
 * Key Principles:
 * - One instance = one atomic license
 * - Can be ASSIGNED to a user or AVAILABLE in the pool
 * - Tracks full lifecycle: purchase → assignment → expiry
 * - Enables mixed license purchases (PLAN + OPTIMIZE in same org)
 */
const licenseInstanceSchema = new mongoose.Schema(
    {
        organization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
            comment: 'Organization that owns this license instance'
        },

        license_code: {
            type: String,
            enum: ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'],
            required: true,
            index: true,
            comment: 'License type - determines features and limits'
        },

        assigned_to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
            comment: 'User who currently owns this license (null = unassigned)'
        },

        status: {
            type: String,
            enum: ['AVAILABLE', 'ASSIGNED', 'EXPIRED', 'CANCELLED'],
            default: 'AVAILABLE',
            index: true,
            comment: 'Current state of the license'
        },

        purchase_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrganizationLicensePurchase',
            required: true,
            index: true,
            comment: 'Reference to the purchase transaction that created this instance'
        },

        billing_cycle: {
            type: String,
            enum: ['MONTHLY', 'YEARLY'],
            required: true,
            comment: 'Billing frequency for this license'
        },

        purchase_date: {
            type: Date,
            required: true,
            comment: 'When this license was purchased'
        },

        renewal_date: {
            type: Date,
            required: true,
            index: true,
            comment: 'When this license expires and needs renewal'
        },

        assigned_at: {
            type: Date,
            default: null,
            comment: 'When this license was assigned to a user'
        },

        released_at: {
            type: Date,
            default: null,
            comment: 'When this license was unassigned from a user'
        }
    },
    {
        timestamps: true,
        comment: 'Atomic license instance - one document per purchasable license unit'
    }
);

// Compound indexes for common queries
licenseInstanceSchema.index({ organization_id: 1, license_code: 1, status: 1 });
licenseInstanceSchema.index({ organization_id: 1, status: 1 });
licenseInstanceSchema.index({ assigned_to: 1, status: 1 });

/**
 * Instance Methods
 */

// Assign this license to a user
licenseInstanceSchema.methods.assignToUser = async function (userId) {
    if (this.status === 'ASSIGNED') {
        throw new Error('License is already assigned');
    }
    if (this.status !== 'AVAILABLE') {
        throw new Error(`Cannot assign license with status: ${this.status}`);
    }

    this.assigned_to = userId;
    this.status = 'ASSIGNED';
    this.assigned_at = new Date();
    this.released_at = null;

    return this.save();
};

// Release this license from current user
licenseInstanceSchema.methods.releaseFromUser = async function () {
    if (this.status !== 'ASSIGNED') {
        throw new Error('License is not currently assigned');
    }

    this.assigned_to = null;
    this.status = 'AVAILABLE';
    this.released_at = new Date();

    return this.save();
};

// Check if license is expired
licenseInstanceSchema.methods.isExpired = function () {
    return this.renewal_date < new Date();
};

// Mark as expired
licenseInstanceSchema.methods.markExpired = async function () {
    this.status = 'EXPIRED';
    return this.save();
};

/**
 * Static Methods
 */

// Get license pool summary for an organization
licenseInstanceSchema.statics.getPoolSummary = async function (organizationId) {
    const summary = await this.aggregate([
        {
            $match: {
                organization_id: new mongoose.Types.ObjectId(organizationId),
                status: { $in: ['AVAILABLE', 'ASSIGNED', 'EXPIRED'] } // Include expired
            }
        },
        {
            $group: {
                _id: '$license_code',
                total: { $sum: 1 },
                assigned: {
                    $sum: { $cond: [{ $eq: ['$status', 'ASSIGNED'] }, 1, 0] }
                },
                available: {
                    $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] }
                },
                expired: {
                    $sum: { $cond: [{ $eq: ['$status', 'EXPIRED'] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                _id: 0,
                license_code: '$_id',
                total: 1,
                assigned: 1,
                available: 1,
                expired: 1
            }
        },
        {
            $sort: { license_code: 1 }
        }
    ]);

    return summary;
};

// Find first available license instance of a specific type
licenseInstanceSchema.statics.findAvailableInstance = async function (organizationId, licenseCode) {
    return this.findOne({
        organization_id: organizationId,
        license_code: licenseCode,
        status: 'AVAILABLE',
        renewal_date: { $gt: new Date() } // Not expired
    }).sort({ purchase_date: 1 }); // FIFO - oldest first
};

// Get all instances for a user
licenseInstanceSchema.statics.getUserLicenses = async function (userId) {
    return this.find({
        assigned_to: userId,
        status: 'ASSIGNED'
    }).populate('purchase_id', 'license_name billing_cycle renewal_date');
};

// Count available licenses by type
licenseInstanceSchema.statics.countAvailable = async function (organizationId, licenseCode) {
    return this.countDocuments({
        organization_id: organizationId,
        license_code: licenseCode,
        status: 'AVAILABLE',
        renewal_date: { $gt: new Date() }
    });
};

// Get instances about to expire (for renewal reminders)
licenseInstanceSchema.statics.findExpiringInstances = async function (daysBeforeExpiry = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysBeforeExpiry);

    return this.find({
        status: { $in: ['AVAILABLE', 'ASSIGNED'] },
        renewal_date: {
            $gte: new Date(),
            $lte: futureDate
        }
    }).populate('organization_id', 'companyName email')
        .populate('assigned_to', 'firstName lastName email');
};

// Bulk create instances for a purchase
licenseInstanceSchema.statics.createInstancesForPurchase = async function (purchaseData) {
    const {
        organization_id,
        license_code,
        purchase_id,
        billing_cycle,
        purchase_date,
        renewal_date,
        quantity,
        session // MongoDB transaction session
    } = purchaseData;

    const instances = [];
    for (let i = 0; i < quantity; i++) {
        instances.push({
            organization_id,
            license_code,
            purchase_id,
            billing_cycle,
            purchase_date,
            renewal_date,
            status: 'AVAILABLE'
        });
    }

    // Use transaction session if provided
    return this.insertMany(instances, session ? { session } : {});
};

// Get license assignment history for an organization
licenseInstanceSchema.statics.getAssignmentHistory = async function (organizationId, options = {}) {
    const {
        license_code,
        user_id,
        startDate,
        endDate,
        limit = 100
    } = options;

    const query = {
        organization_id: organizationId
    };

    if (license_code) query.license_code = license_code;
    if (user_id) query.assigned_to = user_id;
    if (startDate || endDate) {
        query.assigned_at = {};
        if (startDate) query.assigned_at.$gte = startDate;
        if (endDate) query.assigned_at.$lte = endDate;
    }

    return this.find(query)
        .populate('assigned_to', 'firstName lastName email')
        .populate('purchase_id', 'license_name billing_cycle')
        .sort({ assigned_at: -1 })
        .limit(limit);
};

const LicenseInstance = mongoose.model('LicenseInstance', licenseInstanceSchema);

export default LicenseInstance;
