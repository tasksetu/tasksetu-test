import { License } from '../modals/licenseModal.js';
import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';
import { LicenseFeatureMapping } from '../modals/licenseFeatureMappingModal.js';
import { Feature } from '../modals/featureModal.js';
import * as auditLogger from '../utils/auditLogger.js';

/**
 * Get all license plans with statistics
 * GET /api/super-admin/license-plans
 */
export const getAllLicensePlans = async (req, res) => {
  try {
    // Fetch all license plans sorted by display order, excluding EXPIRED
    const plans = await License.find({
      license_code: { $ne: 'EXPIRED' }
    }).sort({ display_order: 1 });

    // Get statistics for each plan
    const plansWithStats = await Promise.all(
      plans.map(async (plan) => {
        // Count active subscriptions for this plan
        const subscriptionCount = await OrganizationSubscription.countDocuments({
          license_code: plan.license_code,
          status: { $in: ['ACTIVE', 'TRIAL'] }
        });

        // Get total seats and revenue
        const subscriptions = await OrganizationSubscription.find({
          license_code: plan.license_code,
          status: { $in: ['ACTIVE', 'TRIAL'] }
        });

        const totalSeats = subscriptions.reduce((sum, sub) => sum + (sub.seats_purchased || 0), 0);
        const usedSeats = subscriptions.reduce((sum, sub) => sum + (sub.seats_used || 0), 0);

        // Calculate monthly revenue
        const monthlyRevenue = subscriptions.reduce((sum, sub) => {
          if (sub.billing_cycle === 'MONTHLY') {
            return sum + (plan.price_monthly * (sub.seats_purchased || 0));
          } else if (sub.billing_cycle === 'YEARLY') {
            return sum + ((plan.price_yearly / 12) * (sub.seats_purchased || 0));
          }
          return sum;
        }, 0);

        // Get features for this license
        const featureMappings = await LicenseFeatureMapping.find({
          license_code: plan.license_code,
          is_enabled: true
        }).lean();

        // Populate feature details
        const featureDetails = await Feature.find({
          feature_code: { $in: featureMappings.map(f => f.feature_code) },
          is_active: true
        }).lean();

        // Create feature map
        const featureMap = {};
        featureDetails.forEach(f => {
          featureMap[f.feature_code] = f;
        });

        // Enrich features with usage limits
        const enrichedFeatures = featureMappings.map(mapping => {
          const feature = featureMap[mapping.feature_code];
          if (!feature) return null;

          return {
            feature_code: feature.feature_code,
            name: feature.name,
            description: feature.description,
            category: feature.category,
            usage_limit: mapping.usage_limit,
            limit_type: mapping.limit_type,
            is_unlimited: mapping.usage_limit === -1
          };
        }).filter(Boolean);

        return {
          ...plan.toObject(),
          features: enrichedFeatures,
          stats: {
            subscriptions: subscriptionCount,
            totalSeats,
            usedSeats,
            availableSeats: totalSeats - usedSeats,
            monthlyRevenue: Math.round(monthlyRevenue)
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      data: plansWithStats,
      count: plansWithStats.length
    });
  } catch (error) {
    console.error('Get all license plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch license plans',
      error: error.message
    });
  }
};

/**
 * Get license analytics and revenue data
 * GET /api/super-admin/license-analytics
 */
export const getLicenseAnalytics = async (req, res) => {
  try {
    // Get all active subscriptions
    const activeSubscriptions = await OrganizationSubscription.find({
      status: { $in: ['ACTIVE', 'TRIAL'] }
    });

    // Calculate total revenue
    let totalMonthlyRevenue = 0;
    let totalYearlyRevenue = 0;
    let totalActiveSeats = 0;
    const planRevenue = {};

    for (const sub of activeSubscriptions) {
      const license = await License.findOne({ license_code: sub.license_code });
      if (!license) continue;

      const seats = sub.seats_purchased || 0;
      totalActiveSeats += sub.seats_used || 0;

      if (sub.billing_cycle === 'MONTHLY') {
        const revenue = license.price_monthly * seats;
        totalMonthlyRevenue += revenue;
        totalYearlyRevenue += revenue * 12;
      } else if (sub.billing_cycle === 'YEARLY') {
        const revenue = license.price_yearly * seats;
        totalYearlyRevenue += revenue;
        totalMonthlyRevenue += revenue / 12;
      }

      // Track per-plan revenue
      if (!planRevenue[sub.license_code]) {
        planRevenue[sub.license_code] = { monthly: 0, yearly: 0, count: 0 };
      }
      planRevenue[sub.license_code].count++;
      if (sub.billing_cycle === 'MONTHLY') {
        planRevenue[sub.license_code].monthly += license.price_monthly * seats;
      } else {
        planRevenue[sub.license_code].yearly += license.price_yearly * seats;
      }
    }

    // Find most popular plan
    let popularPlan = 'PLAN';
    let maxCount = 0;
    const planCounts = {};
    
    for (const [planCode, data] of Object.entries(planRevenue)) {
      planCounts[planCode] = data.count;
      if (data.count > maxCount) {
        maxCount = data.count;
        popularPlan = planCode;
      }
    }

    // 🆕 If no subscriptions, count users with licenses
    if (activeSubscriptions.length === 0) {
      const { User } = await import('../modals/userModal.js');
      
      // Count active users with licenses
      const usersWithLicenses = await User.find({
        license_code: { $exists: true, $ne: null },
        isActive: true
      });

      totalActiveSeats = usersWithLicenses.length;

      // Count users per license type
      usersWithLicenses.forEach(user => {
        const licenseCode = user.license_code;
        planCounts[licenseCode] = (planCounts[licenseCode] || 0) + 1;
      });

      // Find most popular license among users
      maxCount = 0;
      for (const [planCode, count] of Object.entries(planCounts)) {
        if (count > maxCount) {
          maxCount = count;
          popularPlan = planCode;
        }
      }
    }

    // Get growth metrics (compare with last month)
    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

    const newSubscriptionsThisMonth = await OrganizationSubscription.countDocuments({
      subscription_start_date: { $gte: lastMonthStart },
      status: { $in: ['ACTIVE', 'TRIAL'] }
    });

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: Math.round(totalMonthlyRevenue),
        totalYearlyRevenue: Math.round(totalYearlyRevenue),
        totalSubscriptions: activeSubscriptions.length,
        activeSeats: totalActiveSeats,
        popularPlan,
        planRevenue,
        planCounts,
        newSubscriptionsThisMonth,
        averageRevenuePerSubscription: activeSubscriptions.length > 0
          ? Math.round(totalMonthlyRevenue / activeSubscriptions.length)
          : 0
      }
    });
  } catch (error) {
    console.error('Get license analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch license analytics',
      error: error.message
    });
  }
};

/**
 * Get subscribers for a specific plan
 * GET /api/super-admin/license-plans/:planId/subscribers
 */
export const getPlanSubscribers = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await License.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'License plan not found'
      });
    }

    // Get all subscriptions for this plan
    const subscriptions = await OrganizationSubscription.find({
      license_code: plan.license_code,
      status: { $in: ['ACTIVE', 'TRIAL'] }
    }).populate('organization_id');

    // Get organization details
    const subscribers = await Promise.all(
      subscriptions.map(async (sub) => {
        const org = await Organization.findById(sub.organization_id);
        const userCount = await User.countDocuments({
          organization_id: sub.organization_id,
          status: 'active',
          isActive: true
        });

        return {
          organization: {
            id: org?._id,
            name: org?.name,
            email: org?.email
          },
          subscription: {
            status: sub.status,
            billing_cycle: sub.billing_cycle,
            seats_purchased: sub.seats_purchased,
            seats_used: sub.seats_used,
            start_date: sub.subscription_start_date,
            end_date: sub.subscription_end_date
          },
          users: userCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        plan: {
          code: plan.license_code,
          name: plan.name
        },
        subscribers,
        totalSubscribers: subscribers.length
      }
    });
  } catch (error) {
    console.error('Get plan subscribers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plan subscribers',
      error: error.message
    });
  }
};

/**
 * Create new license plan
 * POST /api/super-admin/license-plans
 */
export const createLicensePlan = async (req, res) => {
  try {
    const {
      license_code,
      name,
      description,
      price_monthly,
      price_yearly,
      max_users,
      is_active,
      is_popular,
      display_order,
      features_summary,
      billing_cycle
    } = req.body;

    // Validate required fields
    if (!license_code || !name || !description) {
      return res.status(400).json({
        success: false,
        message: 'License code, name, and description are required'
      });
    }

    // Check if license code already exists
    const existingPlan = await License.findOne({
      license_code: license_code.toUpperCase()
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: 'License plan with this code already exists'
      });
    }

    // Create new license plan
    const newPlan = new License({
      license_code: license_code.toUpperCase(),
      name,
      description,
      billing_cycle: billing_cycle || 'MONTHLY',
      price_monthly: price_monthly || 0,
      price_yearly: price_yearly || 0,
      max_users: max_users || -1,
      is_active: is_active !== undefined ? is_active : true,
      is_popular: is_popular || false,
      display_order: display_order || 0,
      features_summary: features_summary || []
    });

    await newPlan.save();

    // Log Audit Trail
    await auditLogger.logLicensePlanCreated(newPlan, req.user, req);

    res.status(201).json({
      success: true,
      message: 'License plan created successfully',
      data: newPlan
    });
  } catch (error) {
    console.error('Create license plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create license plan',
      error: error.message
    });
  }
};

/**
 * Update existing license plan
 * PUT /api/super-admin/license-plans/:planId
 */
export const updateLicensePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const updateData = req.body;

    // Don't allow changing license_code
    delete updateData.license_code;
    delete updateData._id;

    const updatedPlan = await License.findByIdAndUpdate(
      planId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedPlan) {
      return res.status(404).json({
        success: false,
        message: 'License plan not found'
      });
    }

    // Log Audit Trail
    await auditLogger.logLicensePlanUpdated(updatedPlan, updateData, req.user, req);

    res.status(200).json({
      success: true,
      message: 'License plan updated successfully',
      data: updatedPlan
    });
  } catch (error) {
    console.error('Update license plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update license plan',
      error: error.message
    });
  }
};

/**
 * Toggle plan active/inactive status
 * PATCH /api/super-admin/license-plans/:planId/toggle-status
 */
export const togglePlanStatus = async (req, res) => {
  try {
    const { planId } = req.params;
    const { is_active } = req.body;

    const plan = await License.findByIdAndUpdate(
      planId,
      { $set: { is_active } },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'License plan not found'
      });
    }

    // Log Audit Trail
    await auditLogger.logLicensePlanUpdated(plan, { is_active }, req.user, req);

    res.status(200).json({
      success: true,
      message: `Plan ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: plan
    });
  } catch (error) {
    console.error('Toggle plan status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle plan status',
      error: error.message
    });
  }
};

/**
 * Delete license plan
 * DELETE /api/super-admin/license-plans/:planId
 */
export const deleteLicensePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await License.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'License plan not found'
      });
    }

    // Check if any active subscriptions exist
    const activeSubscriptions = await OrganizationSubscription.countDocuments({
      license_code: plan.license_code,
      status: { $in: ['ACTIVE', 'TRIAL'] }
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete plan with ${activeSubscriptions} active subscriptions. Please migrate or cancel subscriptions first.`
      });
    }

    await License.findByIdAndDelete(planId);

    // Log Audit Trail
    await auditLogger.logLicensePlanDeleted(plan, req.user, req);

    res.status(200).json({
      success: true,
      message: 'License plan deleted successfully'
    });
  } catch (error) {
    console.error('Delete license plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete license plan',
      error: error.message
    });
  }
};

/**
 * Bulk update pricing for multiple plans
 * POST /api/super-admin/license-plans/bulk-update-pricing
 */
export const bulkUpdatePricing = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { planId, price_monthly, price_yearly }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { planId, price_monthly, price_yearly } = update;

        const updatedPlan = await License.findByIdAndUpdate(
          planId,
          {
            $set: {
              price_monthly: price_monthly !== undefined ? price_monthly : undefined,
              price_yearly: price_yearly !== undefined ? price_yearly : undefined
            }
          },
          { new: true }
        );

        if (updatedPlan) {
          results.push(updatedPlan);
        } else {
          errors.push({ planId, error: 'Plan not found' });
        }
      } catch (err) {
        errors.push({ planId: update.planId, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Bulk pricing update completed',
      data: {
        updated: results.length,
        failed: errors.length,
        results,
        errors
      }
    });
  } catch (error) {
    console.error('Bulk update pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update pricing',
      error: error.message
    });
  }
};

/**
 * Get all features
 * GET /api/super-admin/features
 */
export const getAllFeatures = async (req, res) => {
  try {
    const features = await Feature.find({})
      .sort({ category: 1, display_order: 1 });

    res.status(200).json({
      success: true,
      data: features,
      count: features.length
    });
  } catch (error) {
    console.error('Get all features error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch features',
      error: error.message
    });
  }
};

/**
 * Get features for a specific plan
 * GET /api/super-admin/license-plans/:planId/features
 */
export const getPlanFeatures = async (req, res) => {
  try {
    const { planId } = req.params;

    // Get the plan
    const plan = await License.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'License plan not found'
      });
    }

    // Get feature mappings for this plan
    const featureMappings = await LicenseFeatureMapping.find({
      license_code: plan.license_code
    }).lean();

    res.status(200).json({
      success: true,
      data: featureMappings,
      count: featureMappings.length
    });
  } catch (error) {
    console.error('Get plan features error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plan features',
      error: error.message
    });
  }
};

/**
 * Update features for a specific plan
 * POST /api/super-admin/license-plans/:planId/features
 */
export const updatePlanFeatures = async (req, res) => {
  try {
    const { planId } = req.params;
    const { features } = req.body;

    // Get the plan
    const plan = await License.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'License plan not found'
      });
    }

    if (!Array.isArray(features)) {
      return res.status(400).json({
        success: false,
        message: 'Features array is required'
      });
    }

    // Remove existing mappings for this plan
    await LicenseFeatureMapping.deleteMany({
      license_code: plan.license_code
    });

    // Create new mappings
    const newMappings = features.map(feature => ({
      license_code: plan.license_code,
      feature_code: feature.feature_code,
      usage_limit: feature.usage_limit ?? -1,
      limit_type: feature.limit_type || 'MONTHLY',
      is_enabled: feature.is_enabled !== false
    }));

    if (newMappings.length > 0) {
      await LicenseFeatureMapping.insertMany(newMappings);
    }

    // Log Audit Trail
    await auditLogger.logPlanFeaturesUpdated(plan, req.user, req);

    // Get updated mappings
    const updatedMappings = await LicenseFeatureMapping.find({
      license_code: plan.license_code
    });

    res.status(200).json({
      success: true,
      message: 'Plan features updated successfully',
      data: updatedMappings,
      count: updatedMappings.length
    });
  } catch (error) {
    console.error('Update plan features error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update plan features',
      error: error.message
    });
  }
};

/**
 * Toggle feature active status
 * PATCH /api/super-admin/features/:featureCode/toggle-active
 */
export const toggleFeatureActive = async (req, res) => {
  try {
    const { featureCode } = req.params;
    const { view } = req.body;

    const feature = await Feature.findOneAndUpdate(
      { feature_code: featureCode },
      { view },
      { new: true }
    );

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }

    res.status(200).json({
      success: true,
      data: feature
    });
  } catch (error) {
    console.error('Toggle feature active error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feature status',
      error: error.message
    });
  }
};
