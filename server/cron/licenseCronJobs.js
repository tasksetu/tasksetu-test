import cron from 'node-cron';
import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import LicenseInstance from '../modals/licenseInstanceModal.js';
import { User } from '../modals/userModal.js';
import { OrganizationLicensePurchase } from '../modals/organizationLicensePurchaseModal.js';
import { emailService } from '../services/emailService.js';               // ✅ NEW
import { NotificationService } from '../services/notificationService.js'; // ✅ NEW
import { TriggerEvent, EntityType, NotificationPriority, ChannelType } from '../modals/notificationModal.js'; // ✅ NEW

// ─────────────────────────────────────────────────────────────────────────────
// ✅ REAL IMPLEMENTATION: Trial/License Expiry Notification (replaces TODO)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send trial/license expiry notification via email AND in-app
 * @param {Object} subscription - OrganizationSubscription document (populated with org users)
 * @param {string} type - 'WARNING' (before expiry) or 'EXPIRED' (after expiry)
 */
const sendTrialExpiryNotification = async (subscription, type = 'EXPIRED') => {
  try {
    // Get all org admins for this subscription's organization
    const orgAdmins = await User.find({
      organizationId: subscription.organization_id,
      role: { $in: ['org_admin', 'admin'] },
      isActive: true
    }).select('_id firstName lastName email license_code license_expiry');

    const isWarning = type === 'WARNING';
    const daysRemaining = subscription.days_remaining || 0;

    for (const admin of orgAdmins) {
      try {
        // ── Send in-app notification ──
        // Use organizationId as a proxy entity for the notification (needs a valid ObjectId)
        const entityId = subscription._id;

        await NotificationService.createNotification({
          user_id: admin._id,
          trigger_event: TriggerEvent.LICENSE_EXPIRY_REMINDER,
          related_entity: { entity_type: EntityType.SYSTEM, entity_id: entityId },
          title: isWarning
            ? `⏰ Trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
            : '🔔 Trial period has ended',
          message: isWarning
            ? `Your organization's ${subscription.license_code} trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Upgrade now to avoid service interruption.`
            : `Your organization's ${subscription.license_code} trial has expired. Upgrade to continue using premium features.`,
          priority: isWarning && daysRemaining <= 3 ? NotificationPriority.URGENT : NotificationPriority.NORMAL,
          channels: [ChannelType.IN_APP, ChannelType.EMAIL],
          metadata: {
            subscription_id: subscription._id,
            license_code: subscription.license_code,
            days_remaining: daysRemaining,
            notification_type: type
          }
        });

        // ── Send rich HTML license expiry email ──
        if (admin.email) {
          await emailService.sendLicenseExpiryReminderEmail(
            admin,
            {
              licenseCode: subscription.license_code,
              expiryDate: subscription.trial_end_date || subscription.subscription_end_date,
              organizationName: subscription.organization_id?.name || 'Your Organization'
            },
            daysRemaining
          );
        }

        console.log(`📧 [LICENSE] ${type} notification sent to ${admin.email} (${daysRemaining} days remaining)`);
      } catch (adminError) {
        console.error(`❌ [LICENSE] Error notifying admin ${admin._id}:`, adminError.message);
      }
    }
  } catch (error) {
    console.error('❌ Error sending trial expiry notification:', error);
  }
};

/**
 * Cron job to check and expire trials
 * Runs daily at 2:00 AM
 */
export const startTrialExpiryJob = () => {
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('🔄 Running trial expiry check...');
      const expiredCount = await OrganizationSubscription.checkAndExpireTrials();

      if (expiredCount > 0) {
        console.log(`✅ Expired ${expiredCount} trial subscriptions`);
        // Fetch recently expired and notify
        const recentlyExpired = await OrganizationSubscription.find({
          status: 'EXPIRED',
          updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).populate('organization_id', 'name');

        for (const sub of recentlyExpired) {
          sub.days_remaining = 0;
          await sendTrialExpiryNotification(sub, 'EXPIRED');
        }
      } else {
        console.log('✅ No trials to expire');
      }
    } catch (error) {
      console.error('❌ Error in trial expiry job:', error);
    }
  });

  console.log('✅ Trial expiry cron job started (runs daily at 2:00 AM)');
};

/**
 * Cron job to send trial expiry warnings (3 days before expiry)
 * Runs daily at 10:00 AM
 */
export const startTrialWarningJob = () => {
  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('🔄 Running trial warning check...');

      // Find subscriptions expiring in 3 days
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + 3);

      const expiringSubscriptions = await OrganizationSubscription.find({
        status: 'TRIAL',
        trial_end_date: {
          $gte: new Date(),
          $lte: warningDate
        }
      }).populate('organization_id', 'name');

      for (const subscription of expiringSubscriptions) {
        const msRemaining = new Date(subscription.trial_end_date) - new Date();
        subscription.days_remaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
        await sendTrialExpiryNotification(subscription, 'WARNING');
      }

      console.log(`✅ Sent ${expiringSubscriptions.length} trial warning notifications`);
    } catch (error) {
      console.error('❌ Error in trial warning job:', error);
    }
  });

  console.log('✅ Trial warning cron job started (runs daily at 10:00 AM)');
};

/**
 * Cron job to reset expired usage periods
 * Runs daily at 1:00 AM
 */
export const startUsageResetJob = () => {
  cron.schedule('0 1 * * *', async () => {
    try {
      console.log('🔄 Running usage period reset...');
      const resetCount = await FeatureUsageTracking.resetExpiredPeriods();

      if (resetCount > 0) {
        console.log(`✅ Reset ${resetCount} expired usage periods`);
      } else {
        console.log('✅ No usage periods to reset');
      }
    } catch (error) {
      console.error('❌ Error in usage reset job:', error);
    }
  });

  console.log('✅ Usage reset cron job started (runs daily at 1:00 AM)');
};

/**
 * Cron job to handle expired license instances and purchased plans
 * When a license (PLAN, EXECUTE, OPTIMIZE) expires:
 * 1. User is automatically downgraded to EXPLORE
 * 2. The expired license instance is deleted from the pool
 * Runs daily at 3:00 AM
 */
export const startLicenseInstanceExpiryJob = () => {
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('🔄 Running License Expiry check (PLAN, EXECUTE, OPTIMIZE)...');
      const now = new Date();



      // 1. Mark expired OrganizationLicensePurchases as EXPIRED
      const expiredPurchases = await OrganizationLicensePurchase.updateMany(
        {
          renewal_date: { $lte: now },
          status: 'ACTIVE',
          license_code: { $in: ['PLAN', 'EXECUTE', 'OPTIMIZE'] }
        },
        { status: 'EXPIRED' }
      );
      if (expiredPurchases.modifiedCount > 0) {
        console.log(`✅ Marked ${expiredPurchases.modifiedCount} OrganizationLicensePurchases as EXPIRED`);
      }

      // 2. Find all expired LicenseInstances (Purchased licenses)
      const expiredInstances = await LicenseInstance.find({
        renewal_date: { $lte: now },
        license_code: { $in: ['PLAN', 'EXECUTE', 'OPTIMIZE'] }
      });

      if (expiredInstances.length > 0) {
        console.log(`🔍 Found ${expiredInstances.length} expired license instances to process`);

        let processedCount = 0;
        let downgradedCount = 0;

        for (const instance of expiredInstances) {
          // If assigned to a user, downgrade them to EXPLORE
          if (instance.assigned_to) {
            await User.findByIdAndUpdate(instance.assigned_to, {
              $set: {
                license_instance_id: null,
                license_code: 'EXPLORE',
                license_expiry: null,
                'assigned_license.license_code': null,
                'assigned_license.purchase_id': null
              }
            });
            downgradedCount++;
          }

          // Delete the expired license from pool
          await LicenseInstance.findByIdAndDelete(instance._id);
          processedCount++;
        }
        console.log(`✅ Deleted ${processedCount} expired instances, Downgraded ${downgradedCount} users to EXPLORE`);
      }

      // 3. Handle users with direct license assignments
      const expiredDirectUsers = await User.find({
        license_code: { $in: ['PLAN', 'EXECUTE', 'OPTIMIZE'] },
        $or: [
          { license_expiry: { $lte: now } },
          { subscription_end_date: { $lte: now } },
          { 'assigned_license.expiration_date': { $lte: now } }
        ],
        license_instance_id: null
      });

      if (expiredDirectUsers.length > 0) {
        console.log(`🔍 Found ${expiredDirectUsers.length} users with expired direct licenses`);
        let directDowngradeCount = 0;
        for (const user of expiredDirectUsers) {
          await User.findByIdAndUpdate(user._id, {
            $set: {
              license_code: 'EXPLORE',
              license_expiry: null,
              subscription_end_date: null,
              'assigned_license.license_code': null,
              'assigned_license.purchase_id': null,
              'assigned_license.expiration_date': null
            }
          });
          directDowngradeCount++;
        }
        console.log(`✅ Downgraded ${directDowngradeCount} direct users to EXPLORE`);
      }

      // 4. Handle OrganizationSubscription (Old model/Organization-wide fallback)
      const expiredOrgSubs = await OrganizationSubscription.find({
        status: { $in: ['ACTIVE', 'TRIAL'] },
        license_code: { $in: ['PLAN', 'EXECUTE', 'OPTIMIZE'] },
        $or: [
          { subscription_end_date: { $lte: now } },
          { trial_end_date: { $lte: now } }
        ]
      });

      if (expiredOrgSubs.length > 0) {
        console.log(`🔍 Found ${expiredOrgSubs.length} expired OrganizationSubscriptions`);
        for (const sub of expiredOrgSubs) {
          await OrganizationSubscription.updateOne(
            { _id: sub._id },
            {
              $set: {
                status: 'ACTIVE',
                license_code: 'EXPLORE',
                subscription_end_date: null,
                trial_end_date: null
              }
            }
          );
        }
        console.log(`✅ Downgraded ${expiredOrgSubs.length} OrganizationSubscriptions to EXPLORE`);
      }

    } catch (error) {
      console.error('❌ Error in license instance expiry job:', error);
    }
  });

  console.log('✅ License instance expiry cron job started (runs daily at 3:00 AM)');
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ NEW: License Expiry Reminder Job (30 / 15 / 7 / 3 / 1 day warnings)
// Sends email + in-app notification to users before their paid license expires
// ─────────────────────────────────────────────────────────────────────────────

export const startLicenseExpiryReminderJob = () => {
  // Runs daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔔 Running license expiry reminder check...');
      const now = new Date();

      // Reminder thresholds in days
      const reminderDays = [30, 15, 7, 3, 1];

      let totalReminded = 0;

      for (const days of reminderDays) {
        // Target expiry window: users whose license_expiry falls within today ± 12h of the N-day mark
        const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const windowStart = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000);
        const windowEnd   = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000);

        // Find users with paid licenses expiring in this window
        const usersExpiringSoon = await User.find({
          license_code: { $in: ['PLAN', 'EXECUTE', 'OPTIMIZE'] },
          license_expiry: { $gte: windowStart, $lte: windowEnd },
          isActive: true,
          emailVerified: true
        }).select('_id firstName lastName email license_code license_expiry organizationId');

        for (const user of usersExpiringSoon) {
          try {
            // Dedup: skip if already sent a reminder for this user+days threshold today
            const { Notification } = await import('../modals/notificationModal.js');
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);

            const alreadySent = await Notification.findOne({
              user_id: user._id,
              trigger_event: TriggerEvent.LICENSE_EXPIRY_REMINDER,
              'metadata.days_remaining': days,
              created_at: { $gte: todayStart }
            });
            if (alreadySent) continue;

            // Get organization name if available
            let organizationName = '';
            if (user.organizationId) {
              const { Organization } = await import('../modals/organizationModal.js').catch(() => ({}));
              if (Organization) {
                const org = await Organization.findById(user.organizationId).select('name').lean();
                organizationName = org?.name || '';
              }
            }

            // ── Send in-app notification ──
            await NotificationService.createNotification({
              user_id: user._id,
              trigger_event: TriggerEvent.LICENSE_EXPIRY_REMINDER,
              related_entity: { entity_type: EntityType.SYSTEM, entity_id: user._id },
              title: days <= 1
                ? '🚨 License expires tomorrow!'
                : days <= 3
                ? `⚠️ License expires in ${days} days!`
                : `📅 License renewal reminder — ${days} days left`,
              message: `Your ${user.license_code} license expires in ${days} day${days !== 1 ? 's' : ''} on ${new Date(user.license_expiry).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Renew to avoid service interruption.`,
              priority: days <= 3 ? NotificationPriority.URGENT : NotificationPriority.NORMAL,
              channels: [ChannelType.IN_APP, ChannelType.EMAIL],
              metadata: {
                license_code: user.license_code,
                license_expiry: user.license_expiry,
                days_remaining: days,
                reminder_threshold: days
              }
            });

            // ── Send rich HTML license expiry email ──
            if (user.email) {
              await emailService.sendLicenseExpiryReminderEmail(
                user,
                {
                  licenseCode: user.license_code,
                  expiryDate: user.license_expiry,
                  organizationName
                },
                days
              );
            }

            totalReminded++;
            console.log(`📅 [LICENSE REMINDER] ${days}d warning sent to ${user.email} (${user.license_code})`);
          } catch (userError) {
            console.error(`❌ [LICENSE REMINDER] Error processing user ${user._id}:`, userError.message);
          }
        }
      }

      console.log(`✅ License expiry reminders sent: ${totalReminded} notifications`);
    } catch (error) {
      console.error('❌ Error in license expiry reminder job:', error);
    }
  });

  console.log('✅ License expiry reminder job started (runs daily at 9:00 AM, checks 30/15/7/3/1 day thresholds)');
};

/**
 * Initialize all cron jobs
 */
export const initializeCronJobs = () => {
  console.log('🕐 Initializing licensing cron jobs...');
  startTrialExpiryJob();
  startTrialWarningJob();
  startUsageResetJob();
  startLicenseInstanceExpiryJob();
  startLicenseExpiryReminderJob(); // ✅ NEW: 30/15/7/3/1 day reminders for paid licenses
  console.log('✅ All cron jobs initialized\n');
};



