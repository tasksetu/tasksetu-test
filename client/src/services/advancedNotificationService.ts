import { ObjectId } from 'mongoose';
import { 
  TriggerEvent, 
  ChannelType, 
  UserRole, 
  DigestFrequency,
  DigestStatus,
  EscalationLevel,
  EscalationType,
  DeviceType
} from '../models';

import { UserNotificationPreference } from '../models/userNotificationPreference.model';
import { NotificationSuppressionRule } from '../models/notificationSuppressionRule.model';
import { NotificationDigestQueue } from '../models/notificationDigestQueue.model';
import { EscalationLog } from '../models/escalationLog.model';
import { PushNotificationDevice } from '../models/pushNotificationDevice.model';

/**
 * Advanced Notification Management Service
 * Demonstrates integration of all notification system models
 */
export class AdvancedNotificationService {

  /**
   * Check if notification should be suppressed based on rules
   * @param triggerEvent - The notification trigger event
   * @param lastNotificationTime - When the last notification was sent
   * @returns Promise<boolean>
   */
  static async shouldSuppressNotification(
    triggerEvent: TriggerEvent,
    lastNotificationTime: Date
  ): Promise<boolean> {
    try {
      const suppressionRule = await NotificationSuppressionRule.findOne({
        trigger_event: triggerEvent,
        is_active: true
      });

      if (!suppressionRule) {
        return false; // No suppression rule exists
      }

      return suppressionRule.shouldSuppress(lastNotificationTime);
    } catch (error) {
      console.error('Error checking notification suppression:', error);
      return false; // Default to not suppressing on error
    }
  }

  /**
   * Queue notification for digest delivery
   * @param userId - User ID
   * @param notificationId - Notification ID to queue
   * @param frequency - Digest frequency
   * @returns Promise<void>
   */
  static async queueForDigest(
    userId: ObjectId,
    notificationId: ObjectId,
    frequency: DigestFrequency
  ): Promise<void> {
    if (frequency === DigestFrequency.IMMEDIATE) {
      throw new Error('Cannot queue immediate notifications for digest');
    }

    try {
      // Calculate scheduled time based on frequency
      const scheduledFor = this.calculateDigestSchedule(frequency);

      // Find or create digest queue entry
      let digestQueue = await NotificationDigestQueue.findOne({
        user_id: userId,
        frequency,
        scheduled_for: scheduledFor,
        status: DigestStatus.PENDING
      });

      if (!digestQueue) {
        digestQueue = new NotificationDigestQueue({
          user_id: userId,
          notification_ids: [notificationId],
          frequency,
          scheduled_for: scheduledFor,
          status: DigestStatus.PENDING
        });
        await digestQueue.save();
      } else {
        await digestQueue.addNotification(notificationId);
      }

      console.log(`Notification ${notificationId} queued for ${frequency} digest`);
    } catch (error) {
      console.error('Error queueing notification for digest:', error);
      throw error;
    }
  }

  /**
   * Process pending digest notifications
   * @param frequency - Digest frequency to process
   * @returns Promise<number> Number of digests sent
   */
  static async processPendingDigests(frequency: DigestFrequency): Promise<number> {
    try {
      const now = new Date();
      const pendingDigests = await NotificationDigestQueue.find({
        frequency,
        status: DigestStatus.PENDING,
        scheduled_for: { $lte: now }
      }).populate('user_id');

      let processedCount = 0;

      for (const digest of pendingDigests) {
        try {
          // Here you would integrate with your email service
          // await this.sendDigestEmail(digest);
          
          await digest.markAsSent();
          processedCount++;
          console.log(`Sent ${frequency} digest to user ${digest.user_id}`);
        } catch (error) {
          console.error(`Failed to send digest ${digest._id}:`, error);
          digest.status = DigestStatus.FAILED;
          digest.error_message = error instanceof Error ? error.message : 'Unknown error';
          await digest.save();
        }
      }

      return processedCount;
    } catch (error) {
      console.error('Error processing pending digests:', error);
      throw error;
    }
  }

  /**
   * Log task escalation with notification
   * @param taskId - Task ID being escalated
   * @param fromUserId - User ID escalating from
   * @param toUserId - User ID escalating to
   * @param escalationType - Type of escalation
   * @param reason - Escalation reason
   * @param metadata - Additional escalation metadata
   * @param notificationId - Associated notification ID
   * @returns Promise<ObjectId> Escalation log ID
   */
  static async logEscalation(
    taskId: ObjectId,
    fromUserId: ObjectId,
    toUserId: ObjectId,
    escalationType: EscalationType,
    reason: string,
    metadata: {
      hours_overdue?: number;
      task_priority?: string;
      previous_escalations?: number;
    },
    notificationId?: ObjectId
  ): Promise<ObjectId> {
    try {
      // Determine escalation level based on previous escalations
      const previousEscalations = await EscalationLog.countDocuments({
        task_id: taskId
      });

      let escalationLevel: EscalationLevel;
      if (previousEscalations === 0) {
        escalationLevel = EscalationLevel.MANAGER;
      } else if (previousEscalations === 1) {
        escalationLevel = EscalationLevel.SENIOR_MANAGER;
      } else {
        escalationLevel = EscalationLevel.ADMIN;
      }

      const escalationLog = new EscalationLog({
        task_id: taskId,
        escalated_from_user_id: fromUserId,
        escalated_to_user_id: toUserId,
        escalation_level: escalationLevel,
        escalation_type: escalationType,
        reason,
        metadata: {
          ...metadata,
          previous_escalations: previousEscalations
        },
        notification_id: notificationId
      });

      const savedLog = await escalationLog.save();
      console.log(`Escalation logged: ${taskId} -> Level ${escalationLevel}`);
      
      return savedLog._id as ObjectId;
    } catch (error) {
      console.error('Error logging escalation:', error);
      throw error;
    }
  }

  /**
   * Register user device for push notifications
   * @param userId - User ID
   * @param deviceToken - Device token for push notifications
   * @param deviceType - Type of device
   * @param deviceInfo - Additional device information
   * @returns Promise<ObjectId> Device ID
   */
  static async registerPushDevice(
    userId: ObjectId,
    deviceToken: string,
    deviceType: DeviceType,
    deviceInfo: {
      browser?: string;
      os_version?: string;
      app_version?: string;
    }
  ): Promise<ObjectId> {
    try {
      // Check if device already exists
      let device = await PushNotificationDevice.findOne({
        device_token: deviceToken
      });

      if (device) {
        // Update existing device
        device.user_id = userId;
        device.device_type = deviceType;
        device.device_info = deviceInfo;
        await device.updateLastUsed();
      } else {
        // Create new device
        device = new PushNotificationDevice({
          user_id: userId,
          device_token: deviceToken,
          device_type: deviceType,
          device_info: deviceInfo,
          is_active: true,
          last_used_at: new Date()
        });
        await device.save();
      }

      console.log(`Push device registered for user ${userId}: ${deviceType}`);
      return device._id as ObjectId;
    } catch (error) {
      console.error('Error registering push device:', error);
      throw error;
    }
  }

  /**
   * Get active push devices for user
   * @param userId - User ID
   * @returns Promise<Array> Array of active devices
   */
  static async getUserActiveDevices(userId: ObjectId): Promise<Array<{
    _id: ObjectId;
    device_token: string;
    device_type: DeviceType;
    last_used_at: Date;
  }>> {
    try {
      const devices = await PushNotificationDevice.find({
        user_id: userId,
        is_active: true
      }).select('device_token device_type last_used_at');

      return devices.map(device => ({
        _id: device._id as ObjectId,
        device_token: device.device_token,
        device_type: device.device_type,
        last_used_at: device.last_used_at
      }));
    } catch (error) {
      console.error('Error getting user active devices:', error);
      return [];
    }
  }

  /**
   * Comprehensive notification decision engine
   * Combines user preferences, suppression rules, and escalation logic
   */
  static async shouldSendNotificationAdvanced(
    userId: ObjectId,
    triggerEvent: TriggerEvent,
    channelType: ChannelType,
    userRole: UserRole,
    lastNotificationTime?: Date,
    isEscalation: boolean = false
  ): Promise<{
    shouldSend: boolean;
    reason: string;
    useDigest: boolean;
    digestFrequency?: DigestFrequency;
  }> {
    try {
      // 1. Check user preferences
      const userPreferences = await UserNotificationPreference.findOrCreateForUser(userId, userRole);
      
      if (!userPreferences.isChannelEnabled(triggerEvent, channelType)) {
        return {
          shouldSend: false,
          reason: 'Channel disabled in user preferences',
          useDigest: false
        };
      }

      // 2. Check suppression rules (skip for escalations)
      if (!isEscalation && lastNotificationTime) {
        const shouldSuppress = await this.shouldSuppressNotification(triggerEvent, lastNotificationTime);
        if (shouldSuppress) {
          return {
            shouldSend: false,
            reason: 'Notification suppressed due to frequency rules',
            useDigest: false
          };
        }
      }

      // 3. Determine delivery method based on preferences
      const preference = userPreferences.preferences.find(p => p.trigger_event === triggerEvent);
      const digestFrequency = preference?.digest_frequency || DigestFrequency.IMMEDIATE;

      if (digestFrequency === DigestFrequency.IMMEDIATE || isEscalation) {
        return {
          shouldSend: true,
          reason: 'Immediate delivery',
          useDigest: false
        };
      } else {
        return {
          shouldSend: true,
          reason: 'Queued for digest delivery',
          useDigest: true,
          digestFrequency
        };
      }
    } catch (error) {
      console.error('Error in notification decision engine:', error);
      return {
        shouldSend: true, // Default to sending on error
        reason: 'Error in decision engine, defaulting to send',
        useDigest: false
      };
    }
  }

  /**
   * Cleanup inactive devices and expired digests
   * @param daysInactive - Days to consider a device inactive
   * @returns Promise<{devicesDeactivated: number, digestsCleaned: number}>
   */
  static async performCleanup(daysInactive: number = 90): Promise<{
    devicesDeactivated: number;
    digestsCleaned: number;
  }> {
    try {
      // Cleanup inactive devices
      const devicesDeactivated = await PushNotificationDevice.cleanupInactive(daysInactive);

      // Cleanup old failed/sent digests (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const digestCleanupResult = await NotificationDigestQueue.deleteMany({
        $or: [
          { status: DigestStatus.SENT, sent_at: { $lt: thirtyDaysAgo } },
          { status: DigestStatus.FAILED, created_at: { $lt: thirtyDaysAgo } }
        ]
      });

      console.log(`Cleanup completed: ${devicesDeactivated} devices, ${digestCleanupResult.deletedCount} digests`);

      return {
        devicesDeactivated,
        digestsCleaned: digestCleanupResult.deletedCount || 0
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Calculate next digest schedule based on frequency
   * @private
   */
  private static calculateDigestSchedule(frequency: DigestFrequency): Date {
    const now = new Date();
    
    switch (frequency) {
      case DigestFrequency.HOURLY:
        return new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
      
      case DigestFrequency.DAILY:
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // 9 AM next day
        return tomorrow;
      
      case DigestFrequency.WEEKLY:
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + (7 - now.getDay() + 1)); // Next Monday
        nextWeek.setHours(9, 0, 0, 0); // 9 AM
        return nextWeek;
      
      default:
        return now;
    }
  }
}

export default AdvancedNotificationService;