import { CompanyLicense } from '../modals/companyLicenseModal.js';
import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';
import { License } from '../modals/licenseModal.js';
import mongoose from 'mongoose';

/**
 * 🆕 POST /api/licenses/purchase
 * Purchase bulk licenses and add them to company's license pool
 * 
 * Request Body:
 * {
 *   "licenses": [
 *     { "type": "PLAN", "quantity": 4 },
 *     { "type": "EXECUTE", "quantity": 7 },
 *     { "type": "OPTIMIZE", "quantity": 5 }
 *   ],
 *   "billing_cycle": "YEARLY",
 *   "payment_reference": "razorpay_txn_89231"
 * }
 * 
 * Response (201):
 * {
 *   "success": true,
 *   "company_id": "cmp_1021",
 *   "inventory": [
 *     { "type": "PLAN", "total": 4, "available": 4 },
 *     { "type": "EXECUTE", "total": 7, "available": 7 }
 *   ],
 *   "invoice_id": "inv_90871"
 * }
 */
export const purchaseBulkLicenses = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    // Verify user is org admin
    const user = await User.findById(userId);
    if (!user || !user.role.includes('org_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only organization admins can purchase licenses',
      });
    }

    // Verify organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const { licenses, billing_cycle, payment_reference } = req.body;

    if (!licenses || !Array.isArray(licenses)) {
      return res.status(400).json({
        success: false,
        message: 'Licenses must be an array of {type, quantity} objects',
      });
    }

    // Validate license types and quantities
    const { VALID_LICENSE_TYPES } = await import('../utils/licenseConstants.js');
    const purchaseItems = [];
    let totalAmount = 0;

    for (const item of licenses) {
      const licenseType = item.type?.toUpperCase();
      const quantity = item.quantity;

      if (!VALID_LICENSE_TYPES.includes(licenseType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid license type: ${item.type}`,
        });
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for ${licenseType}: must be a positive integer`,
        });
      }

      // Get license pricing
      const licenseInfo = await License.findOne({ code: licenseType });
      if (!licenseInfo) {
        return res.status(404).json({
          success: false,
          message: `License type ${licenseType} not found`,
        });
      }

      purchaseItems.push({
        type: licenseType,
        quantity,
        pricePerUnit: licenseInfo.price || 0,
        totalPrice: (licenseInfo.price || 0) * quantity,
      });

      totalAmount += (licenseInfo.price || 0) * quantity;
    }

    // Create purchase batch record
    const purchaseBatchId = new mongoose.Types.ObjectId();
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create individual license instances
    const createdLicenses = [];
    let licenseCounter = await CompanyLicense.countDocuments({ company_id: organizationId });

    for (const item of purchaseItems) {
      for (let i = 0; i < item.quantity; i++) {
        licenseCounter++;
        const licenseId = `L-${organizationId.toString().substring(0, 8)}-${item.type}-${String(licenseCounter).padStart(4, '0')}`;

        const license = new CompanyLicense({
          license_id: licenseId,
          company_id: organizationId,
          license_type: item.type,
          status: 'AVAILABLE',
          purchase_batch_id: purchaseBatchId,
          purchased_at: new Date(),
          billing_cycle: billing_cycle || 'MONTHLY',
          payment_reference: payment_reference || null,
        });

        await license.save();
        createdLicenses.push(license);
      }
    }

    // Get updated inventory in the required format
    const inventorySummary = await CompanyLicense.getInventorySummary(organizationId);
    const inventory = Object.keys(inventorySummary).map(type => ({
      type,
      total: inventorySummary[type].total,
      available: inventorySummary[type].available
    })).filter(item => item.total > 0);

    res.status(201).json({
      success: true,
      company_id: organizationId.toString(),
      inventory,
      invoice_id: invoiceId
    });

  } catch (error) {
    console.error('❌ Error purchasing bulk licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error purchasing licenses',
      error: error.message,
    });
  }
};

/**
 * 🆕 GET /api/licenses/inventory
 * Get company license inventory
 * 
 * Response:
 * {
 *   "company_id": "cmp_1021",
 *   "inventory": [
 *     { "type": "PLAN", "total": 4, "assigned": 2, "available": 2 },
 *     { "type": "EXECUTE", "total": 7, "assigned": 6, "available": 1 }
 *   ]
 * }
 */
export const getLicenseInventory = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required',
      });
    }

    const inventorySummary = await CompanyLicense.getInventorySummary(organizationId);

    // Transform to array format matching spec
    const inventory = Object.keys(inventorySummary).map(type => ({
      type,
      total: inventorySummary[type].total,
      assigned: inventorySummary[type].assigned,
      available: inventorySummary[type].available
    })).filter(item => item.total > 0); // Only return license types that have been purchased

    res.status(200).json({
      company_id: organizationId.toString(),
      inventory
    });

  } catch (error) {
    console.error('❌ Error fetching license inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching license inventory',
      error: error.message,
    });
  }
};

/**
 * 🆕 GET /api/licenses/available
 * Get available licenses (unassigned) for organization
 * 
 * Query params:
 * - type: filter by license type (optional)
 */
export const getAvailableLicenses = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const { type } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required',
      });
    }

    const licenses = await CompanyLicense.getAvailableLicenses(organizationId, type);

    res.status(200).json({
      success: true,
      available_licenses: licenses,
      count: licenses.length,
    });

  } catch (error) {
    console.error('❌ Error fetching available licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available licenses',
      error: error.message,
    });
  }
};

/**
 * 🆕 GET /api/licenses/assigned
 * Get all assigned licenses for organization with user details
 */
export const getAssignedLicenses = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required',
      });
    }

    const assignedLicenses = await CompanyLicense.find({
      company_id: organizationId,
      status: 'ASSIGNED',
      assigned_to_user_id: { $ne: null },
    })
      .populate('assigned_to_user_id', 'firstName lastName email role')
      .populate('assigned_by', 'firstName lastName email')
      .sort({ assigned_at: -1 });

    res.status(200).json({
      success: true,
      assigned_licenses: assignedLicenses,
      count: assignedLicenses.length,
    });

  } catch (error) {
    console.error('❌ Error fetching assigned licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assigned licenses',
      error: error.message,
    });
  }
};

/**
 * 🆕 GET /api/licenses/:licenseId/details
 * Get detailed information about a specific license instance
 */
export const getLicenseDetails = async (req, res) => {
  try {
    const { licenseId } = req.params;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    const license = await CompanyLicense.findOne({
      _id: licenseId,
      company_id: organizationId,
    })
      .populate('assigned_to_user_id', 'firstName lastName email role status')
      .populate('assigned_by', 'firstName lastName email')
      .populate({
        path: 'assignment_history.user_id',
        select: 'firstName lastName email',
      })
      .populate({
        path: 'assignment_history.performed_by',
        select: 'firstName lastName email',
      });

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'License not found',
      });
    }

    res.status(200).json({
      success: true,
      license: license,
    });

  } catch (error) {
    console.error('❌ Error fetching license details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching license details',
      error: error.message,
    });
  }
};
