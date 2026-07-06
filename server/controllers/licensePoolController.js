import { License } from '../modals/licenseModal.js';
import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { User } from '../modals/userModal.js';
import { Organization } from '../modals/organizationModal.js';

/**
 * Get license pool status across all organizations
 * Shows allocation and availability for each license tier
 */
export const getLicensePoolStatus = async (req, res) => {
  try {
    // Get all license tiers
    const licenses = await License.find({}).sort({ price_monthly: 1 });

    const licensePoolStatus = [];

    for (const license of licenses) {
      // Count organizations with this license
      const totalSubscriptions = await OrganizationSubscription.countDocuments({
        license_code: license.license_code,
        status: { $in: ['ACTIVE', 'TRIAL'] }
      });

      // Calculate total seats purchased across all organizations
      const subscriptions = await OrganizationSubscription.find({
        license_code: license.license_code,
        status: { $in: ['ACTIVE', 'TRIAL'] }
      });

      const totalSeatsPurchased = subscriptions.reduce((sum, sub) => sum + (sub.seats_purchased || 0), 0);
      const totalSeatsUsed = subscriptions.reduce((sum, sub) => sum + (sub.seats_used || 0), 0);
      const totalSeatsAvailable = totalSeatsPurchased - totalSeatsUsed;

      // Count individual users with this license
      const individualUsers = await User.countDocuments({
        license_code: license.license_code,
        account_type: 'individual',
        status: { $in: ['active', 'invited'] }
      });

      licensePoolStatus.push({
        license_code: license.license_code,
        license_name: license.license_code.charAt(0) + license.license_code.slice(1).toLowerCase(),
        display_name: license.license_code === 'EXPLORE' ? 'Explore (Free)' : 
                      license.license_code === 'PLAN' ? 'Plan' :
                      license.license_code === 'EXECUTE' ? 'Execute' :
                      license.license_code === 'OPTIMIZE' ? 'Optimize' : license.license_code,
        organizations: totalSubscriptions,
        total_seats: totalSeatsPurchased,
        seats_used: totalSeatsUsed,
        seats_available: totalSeatsAvailable,
        individual_users: individualUsers,
        total_users: totalSeatsUsed + individualUsers,
        price_monthly: license.price_monthly,
        price_yearly: license.price_yearly,
      });
    }

    res.status(200).json({
      success: true,
      licensePool: licensePoolStatus,
    });
  } catch (error) {
    console.error('❌ Error getting license pool status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting license pool status',
      error: error.message,
    });
  }
};

/**
 * Get license pool status for current organization
 * Shows seat allocation for the admin's organization
 */
export const getOrganizationLicensePool = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId || req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Organization not found',
        error: 'ORGANIZATION_REQUIRED',
      });
    }

    // Get organization subscription
    const subscription = await OrganizationSubscription.findOne({
      organization_id: organizationId,
      status: { $in: ['ACTIVE', 'TRIAL'] }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found',
      });
    }

    // Get all licenses for comparison
    const licenses = await License.find({}).sort({ price_monthly: 1 });

    const licensePoolStatus = licenses.map(license => {
      const isCurrentLicense = license.license_code === subscription.license_code;
      
      return {
        license_code: license.license_code,
        license_name: license.license_code.charAt(0) + license.license_code.slice(1).toLowerCase(),
        display_name: license.license_code === 'EXPLORE' ? 'Explore (Free)' : 
                      license.license_code === 'PLAN' ? 'Plan' :
                      license.license_code === 'EXECUTE' ? 'Execute' :
                      license.license_code === 'OPTIMIZE' ? 'Optimize' : license.license_code,
        is_current: isCurrentLicense,
        total_seats: isCurrentLicense ? subscription.seats_purchased : 0,
        seats_used: isCurrentLicense ? subscription.seats_used : 0,
        seats_available: isCurrentLicense ? subscription.getAvailableSeats() : 0,
        price_monthly: license.price_monthly,
        price_yearly: license.price_yearly,
      };
    });

    res.status(200).json({
      success: true,
      currentLicense: subscription.license_code,
      licensePool: licensePoolStatus,
    });
  } catch (error) {
    console.error('❌ Error getting organization license pool:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting organization license pool',
      error: error.message,
    });
  }
};
