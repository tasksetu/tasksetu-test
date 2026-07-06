import { CompanyLicense } from '../modals/companyLicenseModal.js';
import { User } from '../modals/userModal.js';
import { Organization } from '../modals/organizationModal.js';
import mongoose from 'mongoose';

/**
 * 🆕 PUT /api/users/:userId/license
 * Assign, change, or remove license for a user
 * 
 * Request Body (Assign/Change):
 * {
 *   "license_type": "OPTIMIZE"
 * }
 * 
 * Request Body (Remove):
 * {
 *   "license_type": null
 * }
 * 
 * Response (Success):
 * {
 *   "user_id": "usr_501",
 *   "license": {
 *     "license_id": "lic_7721",
 *     "type": "OPTIMIZE",
 *     "status": "ASSIGNED"
 *   }
 * }
 * 
 * Error (409 – No License Available):
 * {
 *   "error": "NO_LICENSE_AVAILABLE",
 *   "message": "No OPTIMIZE licenses available"
 * }
 */
export const assignUserLicense = async (req, res) => {
  try {
    const { userId } = req.params;
    const { license_type } = req.body;
    const adminId = req.user?.id || req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    // Verify admin permissions
    const admin = await User.findById(adminId);
    if (!admin || !admin.role.includes('org_admin')) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only organization admins can assign licenses',
      });
    }

    // Find target user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Verify user belongs to same organization
    if (user.organization_id?.toString() !== organizationId?.toString()) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'User does not belong to your organization',
      });
    }

    // Case 1: Remove license (license_type is null or empty)
    if (!license_type || license_type === null) {
      return await removeUserLicense(user, adminId, res);
    }

    // Validate license type using constants
    const { VALID_LICENSE_TYPES } = await import('../utils/licenseConstants.js');
    const normalizedLicenseType = license_type.toUpperCase();

    if (!VALID_LICENSE_TYPES.includes(normalizedLicenseType)) {
      return res.status(400).json({
        error: 'INVALID_LICENSE_TYPE',
        message: `Invalid license type: ${license_type}`,
      });
    }

    // Case 2: User already has a license
    if (user.license_id) {
      return await changeUserLicense(user, normalizedLicenseType, adminId, organizationId, res);
    }

    // Case 3: Assign new license to user
    return await assignNewLicense(user, normalizedLicenseType, adminId, organizationId, res);

  } catch (error) {
    console.error('❌ Error assigning user license:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error assigning license',
      details: error.message,
    });
  }
};

/**
 * Helper: Remove license from user
 */
async function removeUserLicense(user, adminId, res) {
  if (!user.license_id) {
    return res.status(400).json({
      error: 'NO_LICENSE_ASSIGNED',
      message: 'User does not have a license assigned',
    });
  }

  // Find and release the license
  const license = await CompanyLicense.findById(user.license_id);
  if (license) {
    await license.releaseFromUser(adminId, 'Admin removed license');
  }

  // Update user
  user.license_id = null;
  await user.save();

  return res.status(200).json({
    user_id: user._id.toString(),
    license: null
  });
}

/**
 * Helper: Change user's existing license to a different type
 */
async function changeUserLicense(user, newLicenseType, adminId, organizationId, res) {
  // Get current license
  const currentLicense = await CompanyLicense.findById(user.license_id);

  if (!currentLicense) {
    // Current license not found, proceed to assign new one
    user.license_id = null;
    await user.save();
    return await assignNewLicense(user, newLicenseType, adminId, organizationId, res);
  }

  // Check if it's the same type
  if (currentLicense.license_type === newLicenseType) {
    return res.status(200).json({
      user_id: user._id.toString(),
      license: {
        license_id: currentLicense.license_id,
        type: currentLicense.license_type,
        status: currentLicense.status
      }
    });
  }

  // Find available license of new type
  const availableLicenses = await CompanyLicense.getAvailableLicenses(organizationId, newLicenseType);

  if (availableLicenses.length === 0) {
    return res.status(409).json({
      error: 'NO_LICENSE_AVAILABLE',
      message: `No ${newLicenseType} licenses available`
    });
  }

  const newLicense = availableLicenses[0];

  // Release old license
  await currentLicense.releaseFromUser(adminId, `Changed to ${newLicenseType}`);

  // Assign new license
  await newLicense.assignToUser(user._id, adminId);

  // Update user
  user.license_id = newLicense._id;
  await user.save();

  return res.status(200).json({
    user_id: user._id.toString(),
    license: {
      license_id: newLicense.license_id,
      type: newLicense.license_type,
      status: newLicense.status
    }
  });
}

/**
 * Helper: Assign new license to user (no previous license)
 */
async function assignNewLicense(user, licenseType, adminId, organizationId, res) {
  // Find available license
  const availableLicenses = await CompanyLicense.getAvailableLicenses(organizationId, licenseType);

  if (availableLicenses.length === 0) {
    return res.status(409).json({
      error: 'NO_LICENSE_AVAILABLE',
      message: `No ${licenseType} licenses available`
    });
  }

  const license = availableLicenses[0];

  // Assign license to user
  await license.assignToUser(user._id, adminId);

  // Update user record
  user.license_id = license._id;
  await user.save();

  return res.status(200).json({
    user_id: user._id.toString(),
    license: {
      license_id: license.license_id,
      type: license.license_type,
      status: license.status
    }
  });
}

/**
 * 🆕 GET /api/users/:userId/license
 * Get license information for a specific user
 * 
 * Response:
 * {
 *   "user_id": "usr_501",
 *   "license": {
 *     "type": "EXECUTE",
 *     "assigned_at": "2025-02-01T10:21:00Z"
 *   }
 * }
 */
export const getUserLicense = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user?.id || req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Check permissions (user can view their own license, or admin can view any user's license)
    const requester = await User.findById(requesterId);
    const isAdmin = requester.role.includes('org_admin') || requester.role.includes('super_admin');
    const isSelf = userId === requesterId.toString();

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to view this user\'s license',
      });
    }

    // Verify user belongs to same organization (if not super admin)
    if (!requester.role.includes('super_admin')) {
      if (user.organization_id?.toString() !== organizationId?.toString()) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'User does not belong to your organization',
        });
      }
    }

    // Get license details if assigned
    let licenseDetails = null;
    if (user.license_id) {
      licenseDetails = await CompanyLicense.findById(user.license_id);
    }

    if (!licenseDetails) {
      return res.status(200).json({
        user_id: user._id.toString(),
        license: null
      });
    }

    res.status(200).json({
      user_id: user._id.toString(),
      license: {
        type: licenseDetails.license_type,
        assigned_at: licenseDetails.assigned_at || licenseDetails.purchased_at
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user license:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error fetching user license',
      details: error.message,
    });
  }
};

/**
 * 🆕 POST /api/users/bulk-assign-licenses
 * Assign licenses to multiple users at once
 * 
 * Request Body:
 * {
 *   "assignments": [
 *     { "user_id": "123", "license_type": "PLAN" },
 *     { "user_id": "456", "license_type": "EXECUTE" }
 *   ]
 * }
 */
export const bulkAssignLicenses = async (req, res) => {
  try {
    const { assignments } = req.body;
    const adminId = req.user?.id || req.user?._id || req.user?.userId;
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    // Verify admin permissions
    const admin = await User.findById(adminId);
    if (!admin || !admin.role.includes('org_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only organization admins can assign licenses',
      });
    }

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignments array',
      });
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const assignment of assignments) {
      const { user_id, license_type } = assignment;

      try {
        const user = await User.findById(user_id);

        if (!user) {
          results.failed.push({
            user_id,
            license_type,
            error: 'User not found',
          });
          continue;
        }

        if (user.organization_id?.toString() !== organizationId?.toString()) {
          results.failed.push({
            user_id,
            license_type,
            error: 'User not in your organization',
          });
          continue;
        }

        // Release old license if exists
        if (user.license_id) {
          const oldLicense = await CompanyLicense.findById(user.license_id);
          if (oldLicense) {
            await oldLicense.releaseFromUser(adminId, 'Bulk assignment');
          }
        }

        // Assign new license
        const availableLicenses = await CompanyLicense.getAvailableLicenses(organizationId, license_type);

        if (availableLicenses.length === 0) {
          results.failed.push({
            user_id,
            license_type,
            error: `No ${license_type} licenses available`,
          });
          continue;
        }

        const license = availableLicenses[0];
        await license.assignToUser(user._id, adminId);

        user.license_id = license._id;
        await user.save();

        results.successful.push({
          user_id,
          user_email: user.email,
          license_type: license.license_type,
          license_id: license.license_id,
        });

      } catch (error) {
        results.failed.push({
          user_id,
          license_type,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      results,
    });

  } catch (error) {
    console.error('❌ Error bulk assigning licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk assigning licenses',
      error: error.message,
    });
  }
};
