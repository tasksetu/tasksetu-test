import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';
import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { License } from '../modals/licenseModal.js';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import { AuditLog } from '../modals/auditLogModal.js';
import { LicenseFeatureMapping } from '../modals/licenseFeatureMappingModal.js';
import * as licenseService from '../services/licenseService.js';
import * as auditLogger from '../utils/auditLogger.js';

/**
 * Search organizations by name, email, or license ID
 * GET /api/super-admin/organizations/search
 */
export const searchOrganizations = async (req, res) => {
  try {
    const { q, page = 1, limit = 20, status } = req.query;

    const query = {};

    // Search filter
    if (q && q.trim()) {
      const searchTerms = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { email: { $regex: q.trim(), $options: 'i' } }
      ];

      // Only add _id search if it's a valid ObjectId
      if (q.match(/^[0-9a-fA-F]{24}$/)) {
        searchTerms.push({ _id: q });
      }

      query.$or = searchTerms;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const organizations = await Organization.find(query)
      .select('name email phone address createdAt status')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    // Get subscription info for each org
    const orgsWithSubscription = await Promise.all(
      organizations.map(async (org) => {
        const subscription = await OrganizationSubscription.findOne({
          organization_id: org._id
        }).lean();

        const userCount = await User.countDocuments({
          organizationId: org._id,
          status: 'active'
        });

        return {
          ...org,
          subscription: subscription ? {
            license_code: subscription.license_code,
            status: subscription.status,
            expiry_date: subscription.expiry_date,
            billing_cycle: subscription.billing_cycle,
            seats_purchased: subscription.seats_purchased,
            seats_used: subscription.seats_used
          } : null,
          userCount
        };
      })
    );

    const total = await Organization.countDocuments(query);

    res.status(200).json({
      success: true,
      data: orgsWithSubscription,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error searching organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching organizations',
      error: error.message
    });
  }
};

/**
 * Get detailed organization information
 * GET /api/super-admin/organizations/:orgId
 */
export const getOrganizationDetails = async (req, res) => {
  try {
    const { orgId } = req.params;

    const organization = await Organization.findById(orgId).lean();
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Get subscription
    const subscription = await OrganizationSubscription.findOne({
      organization_id: orgId
    }).lean();

    // Get license details
    let licenseDetails = null;
    if (subscription) {
      licenseDetails = await License.findOne({
        license_code: subscription.license_code
      }).lean();
    }

    // Get users
    const users = await User.find({ organizationId: orgId })
      .select('firstName lastName email role status createdAt')
      .lean();

    // Get usage stats
    const usageStats = await FeatureUsageTracking.find({
      organization_id: orgId
    }).lean();

    // Get audit logs
    const auditLogs = await AuditLog.find({
      organization_id: orgId,
      action: { $in: ['LICENSE_OVERRIDE', 'TRIAL_EXTENDED', 'LICENSE_SUSPENDED', 'LICENSE_REACTIVATED', 'FEATURE_FLAG_CHANGED'] }
    })
      .populate('actor_id', 'firstName lastName email')
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        organization,
        subscription,
        licenseDetails,
        users,
        usageStats,
        auditLogs
      }
    });
  } catch (error) {
    console.error('❌ Error fetching organization details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching organization details',
      error: error.message
    });
  }
};

/**
 * Override organization license
 * POST /api/super-admin/organizations/:orgId/override-license
 * 
 * ⚡ UPDATED: Now uses centralized licenseService
 */
export const overrideLicense = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { license_code, reason, billing_cycle = 'MONTHLY', seats = 10, extend_days = 30 } = req.body;
    const adminId = req.user?.id || req.user?._id;

    // Validate inputs
    if (!license_code || !reason) {
      return res.status(400).json({
        success: false,
        message: 'License code and reason are required'
      });
    }

    // Check if license exists
    const license = await License.findOne({ license_code: license_code.toUpperCase() });
    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'License plan not found'
      });
    }

    // Check if organization exists
    const organization = await Organization.findById(orgId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Get or create subscription
    let subscription = await OrganizationSubscription.findOne({
      organization_id: orgId
    });

    const now = new Date();
    const expiryDate = new Date(now);

    // ✅ SINGLE SOURCE OF TRUTH: Calculate duration using DB license definition
    let daysToAdd = extend_days;
    if (!daysToAdd) {
      if (license.billing_cycle === 'TRIAL') {
        daysToAdd = license.trial_days;
      } else {
        daysToAdd = billing_cycle === 'YEARLY' ? 365 : 30;
      }
    }

    // Calculate expiry based on duration
    expiryDate.setDate(expiryDate.getDate() + daysToAdd);

    if (subscription) {
      // Update existing subscription
      subscription.license_code = license_code.toUpperCase();
      subscription.billing_cycle = billing_cycle;
      subscription.seats_purchased = seats;
      subscription.status = 'ACTIVE';
      subscription.subscription_start_date = now;
      subscription.subscription_end_date = expiryDate;
      subscription.trial_end_date = null; // Clear trial if upgrading
      subscription.override_reason = reason;
      subscription.overridden_by = adminId;
      subscription.overridden_at = now;
      await subscription.save();
    } else {
      // Create new subscription
      subscription = await OrganizationSubscription.create({
        organization_id: orgId,
        license_code: license_code.toUpperCase(),
        billing_cycle,
        seats_purchased: seats,
        seats_used: 0,
        seats_occupied: 0,
        seats_available: seats,
        status: 'ACTIVE',
        subscription_start_date: now,
        subscription_end_date: expiryDate,
        override_reason: reason,
        overridden_by: adminId,
        overridden_at: now
      });
    }

    // Log Audit Trail
    await auditLogger.logLicenseOverride(organization, license_code.toUpperCase(), req.user, req);

    console.log(`✅ [SUPER ADMIN] License override: Org ${organization.name} → ${license_code.toUpperCase()}`);

    res.status(200).json({
      success: true,
      status: 'UPDATED',
      message: 'License overridden successfully',
      data: {
        subscription: {
          license_code: subscription.license_code,
          status: subscription.status,
          billing_cycle: subscription.billing_cycle,
          seats: subscription.seats_purchased,
          start_date: subscription.subscription_start_date,
          end_date: subscription.subscription_end_date
        },
        auditId: subscription._id
      }
    });
  } catch (error) {
    console.error('❌ Error overriding license:', error);
    res.status(500).json({
      success: false,
      message: 'Error overriding license',
      error: error.message
    });
  }
};

/**
 * Extend trial period
 * POST /api/super-admin/organizations/:orgId/extend-trial
 */
export const extendTrial = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { days, reason } = req.body;
    const adminId = req.user.id;

    if (!days || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Days and reason are required'
      });
    }

    const subscription = await OrganizationSubscription.findOne({
      organization_id: orgId
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found for this organization'
      });
    }

    // Extend expiry date
    const currentExpiry = new Date(subscription.expiry_date);
    currentExpiry.setDate(currentExpiry.getDate() + parseInt(days));

    subscription.expiry_date = currentExpiry;
    subscription.trial_extended_by = adminId;
    subscription.trial_extension_reason = reason;
    subscription.trial_extended_at = new Date();
    await subscription.save();

    // Log Audit Trail
    const organization = await Organization.findById(orgId);
    await auditLogger.logTrialExtension(organization, days, currentExpiry, req.user, req);

    res.status(200).json({
      success: true,
      message: `Trial extended by ${days} days`,
      data: subscription
    });
  } catch (error) {
    console.error('❌ Error extending trial:', error);
    res.status(500).json({
      success: false,
      message: 'Error extending trial',
      error: error.message
    });
  }
};

/**
 * Suspend/Reactivate license
 * POST /api/super-admin/organizations/:orgId/suspend
 */
export const suspendLicense = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { suspend, reason, suspend_until } = req.body;
    const adminId = req.user.id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const subscription = await OrganizationSubscription.findOne({
      organization_id: orgId
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const now = new Date();

    if (suspend) {
      subscription.status = 'SUSPENDED';
      subscription.suspended_at = now;
      subscription.suspended_by = adminId;
      subscription.suspension_reason = reason;
      if (suspend_until) {
        subscription.suspend_until = new Date(suspend_until);
      }
    } else {
      subscription.status = 'ACTIVE';
      subscription.reactivated_at = now;
      subscription.reactivated_by = adminId;
      subscription.reactivation_reason = reason;
    }

    await subscription.save();

    // Log Audit Trail
    const organization = await Organization.findById(orgId);
    await auditLogger.logLicenseSuspension(organization, suspend ? 'suspend' : 'reactivate', req.user, req);

    res.status(200).json({
      success: true,
      message: suspend ? 'License suspended' : 'License reactivated',
      data: subscription
    });
  } catch (error) {
    console.error('❌ Error suspending/reactivating license:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating license status',
      error: error.message
    });
  }
};

/**
 * Override feature flags for organization
 * POST /api/super-admin/organizations/:orgId/feature-flags
 */
export const overrideFeatureFlags = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { feature_code, enabled, reason } = req.body;
    const adminId = req.user.id;

    if (!feature_code || enabled === undefined || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Feature code, enabled status, and reason are required'
      });
    }

    const subscription = await OrganizationSubscription.findOne({
      organization_id: orgId
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    // Initialize feature_overrides if not exists
    if (!subscription.feature_overrides) {
      subscription.feature_overrides = [];
    }

    // Find existing override
    const existingIndex = subscription.feature_overrides.findIndex(
      fo => fo.feature_code === feature_code
    );

    const override = {
      feature_code,
      enabled,
      reason,
      overridden_by: adminId,
      overridden_at: new Date()
    };

    if (existingIndex >= 0) {
      subscription.feature_overrides[existingIndex] = override;
    } else {
      subscription.feature_overrides.push(override);
    }

    await subscription.save();

    // Log Audit Trail
    const organization = await Organization.findById(orgId);
    await auditLogger.logOrgFeatureFlagToggle(organization, feature_code, enabled, req.user, req);

    res.status(200).json({
      success: true,
      message: 'Feature flag overridden',
      data: subscription
    });
  } catch (error) {
    console.error('❌ Error overriding feature flag:', error);
    res.status(500).json({
      success: false,
      message: 'Error overriding feature flag',
      error: error.message
    });
  }
};

/**
 * Export organizations data
 * GET /api/super-admin/export/organizations
 */
export const exportOrganizations = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    const organizations = await Organization.find().lean();

    // Get subscription data for each org
    const data = await Promise.all(
      organizations.map(async (org) => {
        const subscription = await OrganizationSubscription.findOne({
          organization_id: org._id
        }).lean();

        const userCount = await User.countDocuments({
          organizationId: org._id
        });

        return {
          'Organization ID': org._id,
          'Organization Name': org.name,
          'Email': org.email,
          'Phone': org.phone || '',
          'Status': org.status,
          'Created Date': org.createdAt,
          'License Code': subscription?.license_code || 'NONE',
          'License Status': subscription?.status || 'NONE',
          'Billing Cycle': subscription?.billing_cycle || '',
          'Seats Purchased': subscription?.seats_purchased || 0,
          'Seats Used': subscription?.seats_used || 0,
          'Expiry Date': subscription?.expiry_date || '',
          'Is Trial': subscription?.is_trial ? 'Yes' : 'No',
          'Total Users': userCount
        };
      })
    );

    if (format === 'csv') {
      // Generate CSV
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map(row =>
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes
            return typeof value === 'string' && value.includes(',')
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          }).join(',')
        )
      ];

      const csv = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=organizations.csv');
      res.status(200).send(csv);
    } else {
      // Return JSON
      res.status(200).json({
        success: true,
        data
      });
    }
  } catch (error) {
    console.error('❌ Error exporting organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting organizations',
      error: error.message
    });
  }
};

/**
 * Get audit logs
 * GET /api/super-admin/audit-logs
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { getSuperAdminAuditLogs } = await import('../utils/auditLogger.js');
    const {
      action,
      adminId,
      organizationId,
      dateRange,
      page = 1,
      limit = 50
    } = req.query;

    const logs = await getSuperAdminAuditLogs({
      action,
      adminId,
      organizationId,
      dateRange,
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('❌ Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching audit logs',
      error: error.message
    });
  }
};
