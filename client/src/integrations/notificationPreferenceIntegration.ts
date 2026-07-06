import { ObjectId } from 'mongoose';
import { TriggerEvent, ChannelType } from '../models/notification.model';
import { UserRole, DigestFrequency } from '../models/userNotificationPreference.model';
import UserNotificationPreferenceService from '../services/userNotificationPreferenceService';

/**
 * Integration examples showing how to use the TypeScript notification preference system
 * These examples demonstrate real-world usage patterns
 */

export class NotificationPreferenceIntegration {
  
  /**
   * Example: Check if a user should receive a notification before sending
   * This integrates with the existing notification service
   */
  static async shouldSendNotification(
    userId: ObjectId,
    triggerEvent: TriggerEvent,
    channelType: ChannelType,
    userRole: UserRole
  ): Promise<boolean> {
    try {
      return await UserNotificationPreferenceService.isChannelEnabled(
        userId,
        triggerEvent,
        channelType,
        userRole
      );
    } catch (error) {
      console.error('Error checking notification permission:', error);
      // Default to allowing in-app and email notifications if error occurs
      return channelType === ChannelType.IN_APP || channelType === ChannelType.EMAIL;
    }
  }

  /**
   * Example: Setup notification preferences for a new user
   * This would be called during user registration/onboarding
   */
  static async setupNewUserPreferences(
    userId: ObjectId,
    role: UserRole
  ): Promise<void> {
    try {
      await UserNotificationPreferenceService.getUserPreferences(userId, role);
      console.log(`Notification preferences created for user ${userId} with role ${role}`);
    } catch (error) {
      console.error('Error setting up new user preferences:', error);
      throw error;
    }
  }

  /**
   * Example: Update preferences when user wants to customize notifications
   * This would be used by a settings UI component
   */
  static async updateUserNotificationSettings(
    userId: ObjectId,
    settings: {
      taskNotifications: {
        inApp: boolean;
        email: boolean;
        push: boolean;
        frequency: DigestFrequency;
      };
      urgentNotifications: {
        inApp: boolean;
        email: boolean;
        push: boolean;
        sms: boolean;
      };
    },
    userRole: UserRole
  ): Promise<void> {
    try {
      // Update task-related notifications
      const taskEvents = [
        TriggerEvent.TASK_CREATED,
        TriggerEvent.TASK_UPDATED,
        TriggerEvent.TASK_REASSIGNED,
        TriggerEvent.TASK_COMPLETED
      ];

      for (const event of taskEvents) {
        await UserNotificationPreferenceService.updatePreference(
          userId,
          event,
          {
            in_app: settings.taskNotifications.inApp,
            email: settings.taskNotifications.email,
            push: settings.taskNotifications.push,
            sms: false
          },
          settings.taskNotifications.frequency,
          userRole
        );
      }

      // Update urgent notifications
      const urgentEvents = [
        TriggerEvent.TASK_OVERDUE,
        TriggerEvent.OVERDUE_ESCALATION,
        TriggerEvent.CRITICAL_ESCALATION,
        TriggerEvent.TASK_DUE_TODAY
      ];

      for (const event of urgentEvents) {
        await UserNotificationPreferenceService.updatePreference(
          userId,
          event,
          {
            in_app: settings.urgentNotifications.inApp,
            email: settings.urgentNotifications.email,
            push: settings.urgentNotifications.push,
            sms: settings.urgentNotifications.sms
          },
          DigestFrequency.IMMEDIATE, // Urgent notifications should always be immediate
          userRole
        );
      }

      console.log(`Updated notification settings for user ${userId}`);
    } catch (error) {
      console.error('Error updating user notification settings:', error);
      throw error;
    }
  }

  /**
   * Example: Handle role change - update preferences accordingly
   * This would be called when a user's role changes in the system
   */
  static async handleUserRoleChange(
    userId: ObjectId,
    oldRole: UserRole,
    newRole: UserRole
  ): Promise<void> {
    try {
      await UserNotificationPreferenceService.updateUserRole(userId, newRole);
      console.log(`Updated notification preferences for role change: ${oldRole} -> ${newRole}`);
    } catch (error) {
      console.error('Error handling user role change:', error);
      throw error;
    }
  }

  /**
   * Example: Get users for digest notifications
   * This would be used by the cron job service to send digest emails
   */
  static async getDailyDigestUsers(): Promise<Array<{
    userId: ObjectId;
    preferences: any;
  }>> {
    try {
      const users = await UserNotificationPreferenceService.getUsersForDigest(
        DigestFrequency.DAILY,
        [
          TriggerEvent.TASK_CREATED,
          TriggerEvent.TASK_UPDATED,
          TriggerEvent.TASK_COMPLETED,
          TriggerEvent.COMMENT_ADDED
        ]
      );

      return users.map(user => ({
        userId: user.user_id,
        preferences: user.preferences
      }));
    } catch (error) {
      console.error('Error getting daily digest users:', error);
      return [];
    }
  }

  /**
   * Example: Bulk update preferences for all users of a specific role
   * This could be used by administrators to update company-wide settings
   */
  static async updateRoleBasedPreferences(
    role: UserRole,
    eventType: TriggerEvent,
    channelUpdates: {
      in_app?: boolean;
      email?: boolean;
      push?: boolean;
      sms?: boolean;
    },
    digestFrequency?: DigestFrequency
  ): Promise<number> {
    try {
      // This would require a database query to get all users with the specific role
      // For demonstration, we'll show the structure
      const usersWithRole = await this.getUsersByRole(role); // Hypothetical method
      
      let updatedCount = 0;
      
      for (const user of usersWithRole) {
        try {
          await UserNotificationPreferenceService.updatePreference(
            user._id,
            eventType,
            channelUpdates,
            digestFrequency,
            role
          );
          updatedCount++;
        } catch (error) {
          console.error(`Failed to update preferences for user ${user._id}:`, error);
        }
      }

      console.log(`Updated preferences for ${updatedCount} users with role ${role}`);
      return updatedCount;
    } catch (error) {
      console.error('Error updating role-based preferences:', error);
      throw error;
    }
  }

  /**
   * Example: Get notification dashboard data for a user
   * This would be used to display user's notification statistics
   */
  static async getUserNotificationDashboard(userId: ObjectId): Promise<{
    stats: any;
    recentActivity: any[];
    recommendations: string[];
  }> {
    try {
      const stats = await UserNotificationPreferenceService.getUserNotificationStats(userId);
      
      // Generate recommendations based on current settings
      const recommendations: string[] = [];
      
      if (stats.enabled_channels[ChannelType.EMAIL] < 5) {
        recommendations.push('Consider enabling email notifications for important task updates');
      }
      
      if (stats.enabled_channels[ChannelType.PUSH] === 0 && 
          (stats.role === UserRole.MANAGER || stats.role === UserRole.ADMIN)) {
        recommendations.push('Enable push notifications for urgent escalations');
      }
      
      if (stats.digest_frequencies[DigestFrequency.IMMEDIATE] > 15) {
        recommendations.push('Consider using daily digest for some notifications to reduce interruptions');
      }

      return {
        stats,
        recentActivity: [], // Would be populated with actual notification history
        recommendations
      };
    } catch (error) {
      console.error('Error getting user notification dashboard:', error);
      throw error;
    }
  }

  /**
   * Hypothetical helper method to get users by role
   * In a real implementation, this would query your User model
   */
  private static async getUsersByRole(role: UserRole): Promise<Array<{ _id: ObjectId }>> {
    // This is a placeholder - implement based on your User model
    return [];
  }
}

/**
 * Usage Examples:
 * 
 * // 1. During user registration
 * await NotificationPreferenceIntegration.setupNewUserPreferences(
 *   new ObjectId('507f1f77bcf86cd799439011'),
 *   UserRole.ASSIGNEE
 * );
 * 
 * // 2. Before sending a notification
 * const shouldSend = await NotificationPreferenceIntegration.shouldSendNotification(
 *   userId,
 *   TriggerEvent.TASK_OVERDUE,
 *   ChannelType.EMAIL,
 *   UserRole.ASSIGNEE
 * );
 * 
 * // 3. Updating user settings from UI
 * await NotificationPreferenceIntegration.updateUserNotificationSettings(
 *   userId,
 *   {
 *     taskNotifications: {
 *       inApp: true,
 *       email: true,
 *       push: false,
 *       frequency: DigestFrequency.DAILY
 *     },
 *     urgentNotifications: {
 *       inApp: true,
 *       email: true,
 *       push: true,
 *       sms: false
 *     }
 *   },
 *   UserRole.ASSIGNEE
 * );
 * 
 * // 4. Getting digest users for cron job
 * const digestUsers = await NotificationPreferenceIntegration.getDailyDigestUsers();
 */

export default NotificationPreferenceIntegration;