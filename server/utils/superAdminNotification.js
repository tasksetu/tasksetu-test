import { User } from '../modals/userModal.js';
import { NotificationSettings } from '../modals/notificationSettingsModal.js';
import { emailService } from '../services/emailService.js';

/**
 * Helper function to send email notifications to all super admins
 * Checks notification settings before sending
 */

class SuperAdminNotificationService {
  /**
   * Get all super admins with email notifications enabled
   */
  async getSuperAdminsWithEmailEnabled(eventType) {
    try {
      // Find all super admins
      const superAdmins = await User.find({
        role: { $in: ['super_admin', ['super_admin']] },
        isActive: true,
        status: 'active'
      }).select('email firstName lastName');

      if (!superAdmins || superAdmins.length === 0) {
        console.log('⚠️ No active super admins found');
        return [];
      }

      // Check notification settings for each super admin
      const enabledSuperAdmins = [];

      for (const admin of superAdmins) {
        const settings = await NotificationSettings.findOne({ user_id: admin._id });

        // If no settings found, use defaults (enabled)
        if (!settings) {
          enabledSuperAdmins.push(admin);
          continue;
        }

        // Check if notifications are globally enabled
        if (!settings.notifications_enabled) {
          console.log(`🔕 Notifications globally disabled for ${admin.email}`);
          continue;
        }

        // Check if email channel is enabled
        if (!settings.channels?.email?.enabled) {
          console.log(`📧 Email notifications disabled for ${admin.email}`);
          continue;
        }

        // Check if specific event is enabled
        if (eventType && settings.event_preferences?.[eventType] === false) {
          console.log(`🚫 Event '${eventType}' disabled for ${admin.email}`);
          continue;
        }

        enabledSuperAdmins.push(admin);
      }

      console.log(`✅ Found ${enabledSuperAdmins.length} super admin(s) with email notifications enabled`);
      return enabledSuperAdmins;

    } catch (error) {
      console.error('❌ Error fetching super admins:', error);
      return [];
    }
  }

  /**
   * Notify super admins about new organization registration
   */
  async notifyNewOrganization(organizationData) {
    try {
      const superAdmins = await this.getSuperAdminsWithEmailEnabled('new_organization_registration');

      if (superAdmins.length === 0) {
        console.log('⚠️ No super admins to notify for organization registration');
        return;
      }

      const emailPromises = superAdmins.map(admin =>
        emailService.sendSuperAdminOrgRegistrationEmail(admin.email, organizationData)
      );

      await Promise.allSettled(emailPromises);
      console.log(`✅ Notified ${superAdmins.length} super admin(s) about new organization: ${organizationData.name}`);

    } catch (error) {
      console.error('❌ Error notifying super admins about organization:', error);
    }
  }

  /**
   * Notify super admins about new user registration
   */
  async notifyNewUser(userData) {
    try {
      const superAdmins = await this.getSuperAdminsWithEmailEnabled('new_user_registration');

      if (superAdmins.length === 0) {
        console.log('⚠️ No super admins to notify for user registration');
        return;
      }

      const emailPromises = superAdmins.map(admin =>
        emailService.sendSuperAdminUserRegistrationEmail(admin.email, userData)
      );

      await Promise.allSettled(emailPromises);
      console.log(`✅ Notified ${superAdmins.length} super admin(s) about new user: ${userData.email}`);

    } catch (error) {
      console.error('❌ Error notifying super admins about user registration:', error);
    }
  }

  /**
   * Notify super admins about package/plan purchase
   */
  async notifyPackagePurchase(purchaseData) {
    try {
      const superAdmins = await this.getSuperAdminsWithEmailEnabled('package_plan_purchase');

      if (superAdmins.length === 0) {
        console.log('⚠️ No super admins to notify for package purchase');
        return;
      }

      const emailPromises = superAdmins.map(admin =>
        emailService.sendSuperAdminPackagePurchaseEmail(admin.email, purchaseData)
      );

      await Promise.allSettled(emailPromises);
      console.log(`✅ Notified ${superAdmins.length} super admin(s) about package purchase: ${purchaseData.packageName}`);

    } catch (error) {
      console.error('❌ Error notifying super admins about package purchase:', error);
    }
  }
}

export const superAdminNotification = new SuperAdminNotificationService();
