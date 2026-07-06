import { ObjectId } from 'mongoose';
import { TriggerEvent, ChannelType } from '../models/notification.model';
import UserNotificationPreference, { 
  IUserNotificationPreference, 
  DigestFrequency, 
  UserRole,
  INotificationPreference,
  getDefaultPreferencesByRole
} from '../models/userNotificationPreference.model';

/**
 * Service class for managing user notification preferences
 * Provides business logic for notification preference operations
 */
export class UserNotificationPreferenceService {
  
  /**
   * Get user notification preferences, create with defaults if not found
   * @param userId - The user's ObjectId
   * @param role - The user's role (required for creating defaults)
   * @returns Promise<IUserNotificationPreference>
   */
  static async getUserPreferences(userId: ObjectId, role: UserRole): Promise<IUserNotificationPreference> {
    try {
      return await UserNotificationPreference.findOrCreateForUser(userId, role);
    } catch (error) {
      console.error('Error getting user preferences:', error);
      throw new Error('Failed to retrieve user notification preferences');
    }
  }

  /**
   * Check if a specific channel is enabled for a trigger event
   * @param userId - The user's ObjectId
   * @param triggerEvent - The notification trigger event
   * @param channelType - The channel type to check
   * @param userRole - The user's role (for fallback if preferences don't exist)
   * @returns Promise<boolean>
   */
  static async isChannelEnabled(
    userId: ObjectId, 
    triggerEvent: TriggerEvent, 
    channelType: ChannelType,
    userRole: UserRole
  ): Promise<boolean> {
    try {
      const userPreferences = await this.getUserPreferences(userId, userRole);
      return userPreferences.isChannelEnabled(triggerEvent, channelType);
    } catch (error) {
      console.error('Error checking channel enabled status:', error);
      // Return default enabled status if error occurs
      return channelType === ChannelType.IN_APP || channelType === ChannelType.EMAIL;
    }
  }

  /**
   * Update notification preferences for a specific trigger event
   * @param userId - The user's ObjectId
   * @param triggerEvent - The notification trigger event
   * @param channels - Partial channel configuration
   * @param digestFrequency - Optional digest frequency
   * @param userRole - The user's role (for creating if doesn't exist)
   * @returns Promise<IUserNotificationPreference>
   */
  static async updatePreference(
    userId: ObjectId,
    triggerEvent: TriggerEvent,
    channels: Partial<{
      in_app: boolean;
      email: boolean;
      push: boolean;
      sms: boolean;
    }>,
    digestFrequency?: DigestFrequency,
    userRole?: UserRole
  ): Promise<IUserNotificationPreference> {
    try {
      const userPreferences = await this.getUserPreferences(
        userId, 
        userRole || UserRole.ASSIGNEE
      );
      
      return await userPreferences.updatePreference(
        triggerEvent,
        channels,
        digestFrequency
      );
    } catch (error) {
      console.error('Error updating user preference:', error);
      throw new Error('Failed to update notification preference');
    }
  }

  /**
   * Bulk update multiple notification preferences
   * @param userId - The user's ObjectId
   * @param preferences - Array of preference updates
   * @param userRole - The user's role
   * @returns Promise<IUserNotificationPreference>
   */
  static async updateMultiplePreferences(
    userId: ObjectId,
    preferences: Array<{
      trigger_event: TriggerEvent;
      channels: Partial<{
        in_app: boolean;
        email: boolean;
        push: boolean;
        sms: boolean;
      }>;
      digest_frequency?: DigestFrequency;
    }>,
    userRole: UserRole
  ): Promise<IUserNotificationPreference> {
    try {
      const userPreferences = await this.getUserPreferences(userId, userRole);
      
      // Update each preference
      for (const preference of preferences) {
        await userPreferences.updatePreference(
          preference.trigger_event,
          preference.channels,
          preference.digest_frequency
        );
      }
      
      return userPreferences;
    } catch (error) {
      console.error('Error updating multiple preferences:', error);
      throw new Error('Failed to update multiple notification preferences');
    }
  }

  /**
   * Reset user preferences to role-based defaults
   * @param userId - The user's ObjectId
   * @param role - The user's role
   * @returns Promise<IUserNotificationPreference>
   */
  static async resetToDefaults(userId: ObjectId, role: UserRole): Promise<IUserNotificationPreference> {
    try {
      // Delete existing preferences
      await UserNotificationPreference.findOneAndDelete({ user_id: userId });
      
      // Create new with defaults
      return await UserNotificationPreference.findOrCreateForUser(userId, role);
    } catch (error) {
      console.error('Error resetting user preferences:', error);
      throw new Error('Failed to reset notification preferences');
    }
  }

  /**
   * Get users who should receive digest notifications
   * @param frequency - The digest frequency to filter by
   * @param triggerEvents - Optional array of trigger events to filter by
   * @returns Promise<IUserNotificationPreference[]>
   */
  static async getUsersForDigest(
    frequency: DigestFrequency,
    triggerEvents?: TriggerEvent[]
  ): Promise<IUserNotificationPreference[]> {
    try {
      const query: any = {};
      
      if (triggerEvents && triggerEvents.length > 0) {
        query['preferences.trigger_event'] = { $in: triggerEvents };
        query['preferences.digest_frequency'] = frequency;
      } else {
        query['preferences.digest_frequency'] = frequency;
      }
      
      return await UserNotificationPreference.find(query).populate('user_id');
    } catch (error) {
      console.error('Error getting users for digest:', error);
      throw new Error('Failed to retrieve users for digest notifications');
    }
  }

  /**
   * Update user role and refresh preferences accordingly
   * @param userId - The user's ObjectId
   * @param newRole - The new user role
   * @returns Promise<IUserNotificationPreference>
   */
  static async updateUserRole(userId: ObjectId, newRole: UserRole): Promise<IUserNotificationPreference> {
    try {
      const existingPreferences = await UserNotificationPreference.findOne({ user_id: userId });
      
      if (!existingPreferences) {
        // Create new preferences with the new role
        return await UserNotificationPreference.findOrCreateForUser(userId, newRole);
      }
      
      // Update the role
      existingPreferences.role = newRole;
      
      // Get default preferences for the new role
      const defaultPreferences = getDefaultPreferencesByRole(newRole);
      
      // Merge existing custom preferences with new role defaults
      const updatedPreferences: INotificationPreference[] = [];
      
      for (const defaultPref of defaultPreferences) {
        const existingPref = existingPreferences.preferences.find(
          p => p.trigger_event === defaultPref.trigger_event
        );
        
        if (existingPref) {
          // Keep existing preference but update digest frequency based on role if it was default
          updatedPreferences.push({
            trigger_event: existingPref.trigger_event,
            channels: existingPref.channels,
            digest_frequency: existingPref.digest_frequency === DigestFrequency.DAILY ? 
              defaultPref.digest_frequency : existingPref.digest_frequency
          });
        } else {
          // Use new default preference
          updatedPreferences.push(defaultPref);
        }
      }
      
      existingPreferences.preferences = updatedPreferences;
      return await existingPreferences.save();
    } catch (error) {
      console.error('Error updating user role preferences:', error);
      throw new Error('Failed to update user role and preferences');
    }
  }

  /**
   * Get notification statistics for a user
   * @param userId - The user's ObjectId
   * @returns Promise<object> Statistics about user's notification preferences
   */
  static async getUserNotificationStats(userId: ObjectId): Promise<{
    total_events: number;
    enabled_channels: { [key in ChannelType]: number };
    digest_frequencies: { [key in DigestFrequency]: number };
    role: UserRole;
  }> {
    try {
      const userPreferences = await UserNotificationPreference.findOne({ user_id: userId });
      
      if (!userPreferences) {
        return {
          total_events: 0,
          enabled_channels: {
            [ChannelType.IN_APP]: 0,
            [ChannelType.EMAIL]: 0,
            [ChannelType.PUSH]: 0,
            [ChannelType.SMS]: 0
          },
          digest_frequencies: {
            [DigestFrequency.IMMEDIATE]: 0,
            [DigestFrequency.HOURLY]: 0,
            [DigestFrequency.DAILY]: 0,
            [DigestFrequency.WEEKLY]: 0
          },
          role: UserRole.ASSIGNEE
        };
      }
      
      const stats = {
        total_events: userPreferences.preferences.length,
        enabled_channels: {
          [ChannelType.IN_APP]: 0,
          [ChannelType.EMAIL]: 0,
          [ChannelType.PUSH]: 0,
          [ChannelType.SMS]: 0
        },
        digest_frequencies: {
          [DigestFrequency.IMMEDIATE]: 0,
          [DigestFrequency.HOURLY]: 0,
          [DigestFrequency.DAILY]: 0,
          [DigestFrequency.WEEKLY]: 0
        },
        role: userPreferences.role
      };
      
      // Count enabled channels and digest frequencies
      for (const preference of userPreferences.preferences) {
        // Count enabled channels
        if (preference.channels.in_app) stats.enabled_channels[ChannelType.IN_APP]++;
        if (preference.channels.email) stats.enabled_channels[ChannelType.EMAIL]++;
        if (preference.channels.push) stats.enabled_channels[ChannelType.PUSH]++;
        if (preference.channels.sms) stats.enabled_channels[ChannelType.SMS]++;
        
        // Count digest frequencies
        stats.digest_frequencies[preference.digest_frequency]++;
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting user notification stats:', error);
      throw new Error('Failed to retrieve notification statistics');
    }
  }
}

export default UserNotificationPreferenceService;