import { ObjectId } from 'mongodb';
import { BaseNotificationChannel } from './baseNotificationChannel';
import { 
  INotification, 
  ChannelType, 
  ChannelStatus,
  NotificationPriority,
  PushNotificationDevice,
  IPushNotificationDevice,
  DeviceType
} from '../models';

/**
 * Firebase Admin SDK interfaces for dependency injection
 */
interface FirebaseApp {
  messaging(): FirebaseMessaging;
}

interface FirebaseMessaging {
  send(message: any): Promise<string>;
  sendToDevice(token: string | string[], payload: any, options?: any): Promise<any>;
}

interface FirebaseAdmin {
  initializeApp(config: any): FirebaseApp;
  credential: {
    cert(config: any): any;
  };
}

/**
 * Push notification payload interface
 */
export interface PushPayload {
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
  };
  data: {
    notification_id: string;
    related_entity: string;
    url: string;
    timestamp: string;
    priority: string;
  };
}

/**
 * Logger interface for dependency injection
 */
interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
}

/**
 * Notification model interface for dependency injection
 */
interface NotificationModelType {
  updateOne(filter: any, update: any, options?: any): Promise<any>;
}

/**
 * Push notification channel implementation
 * Handles push notifications through Firebase Cloud Messaging
 */
export class PushNotificationChannel extends BaseNotificationChannel {
  private firebaseApp: FirebaseApp | null = null;
  private isEnabled: boolean = false;
  private messaging: FirebaseMessaging | null = null;

  constructor(
    firebaseAdmin: FirebaseAdmin,
    logger: Logger,
    notificationModel: NotificationModelType,
    maxRetries: number = 3
  ) {
    super(logger, notificationModel, maxRetries);

    // Check feature flag
    this.isEnabled = process.env.ENABLE_PUSH_NOTIFICATIONS === 'true';

    if (this.isEnabled) {
      try {
        this.initializeFirebase(firebaseAdmin);
        this.logger.info('Push notification channel initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize push notification channel', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        this.isEnabled = false;
      }
    } else {
      this.logger.info('Push notifications disabled by feature flag');
    }
  }

  /**
   * Send push notification
   * @param notification - Notification to send
   * @param user - User object
   * @returns True if sent successfully to at least one device
   */
  async send(notification: INotification, user: any): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.info('Push notifications disabled, skipping send', {
        notification_id: notification._id,
        user_id: user._id || user.id
      });
      return false;
    }

    try {
      // Get user's active devices
      const devices = await this.getUserActiveDevices(user._id || user.id);

      if (devices.length === 0) {
        this.logger.info('No active devices found for user', {
          notification_id: notification._id,
          user_id: user._id || user.id
        });

        await this.logChannelStatus(
          notification._id as any,
          ChannelType.PUSH,
          ChannelStatus.FAILED,
          'No active devices found'
        );

        return false;
      }

      // Build push payload
      const pushPayload = this.buildPushPayload(notification, user);
      
      let successCount = 0;
      let failureCount = 0;
      const deviceErrors: string[] = [];

      // Send to each device
      for (const device of devices) {
        try {
          await this.sendToDevice(device.device_token, pushPayload);
          
          // Update device last used
          await device.updateLastUsed();
          successCount++;

          this.logger.info('Push notification sent successfully to device', {
            notification_id: notification._id,
            user_id: user._id || user.id,
            device_token: device.device_token.substring(0, 20) + '...',
            device_type: device.device_type
          });

        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          deviceErrors.push(errorMessage);

          this.logger.error('Failed to send push notification to device', {
            notification_id: notification._id,
            user_id: user._id || user.id,
            device_token: device.device_token.substring(0, 20) + '...',
            device_type: device.device_type,
            error: errorMessage
          });

          // Handle device-specific errors
          await this.handleDeviceError(device, error);
        }
      }

      // Determine overall success
      const overallSuccess = successCount > 0;

      if (overallSuccess) {
        await this.logChannelStatus(
          notification._id as any,
          ChannelType.PUSH,
          ChannelStatus.SENT
        );

        this.logger.info('Push notification campaign completed', {
          notification_id: notification._id,
          user_id: user._id || user.id,
          total_devices: devices.length,
          successful_sends: successCount,
          failed_sends: failureCount
        });
      } else {
        await this.logChannelStatus(
          notification._id as any,
          ChannelType.PUSH,
          ChannelStatus.FAILED,
          `All devices failed: ${deviceErrors.join(', ')}`
        );
      }

      return overallSuccess;

    } catch (error) {
      this.logger.error('Failed to process push notification', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await this.logChannelStatus(
        notification._id as any,
        ChannelType.PUSH,
        ChannelStatus.FAILED,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return false;
    }
  }

  /**
   * Check if user can receive push notifications
   * @param user - User object
   * @returns True if can send push notifications
   */
  async canSend(user: any): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      // Check if user has active devices
      const devices = await this.getUserActiveDevices(user._id || user.id);
      
      if (devices.length === 0) {
        return false;
      }

      // TODO: Check user preferences for push notifications
      // const preferences = await UserNotificationPreference.findOne({ user_id: user._id });
      // if (preferences && !preferences.isChannelEnabled(triggerEvent, ChannelType.PUSH)) {
      //   return false;
      // }

      return true;

    } catch (error) {
      this.logger.error('Failed to check push notification capability', {
        user_id: user._id || user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Register a new device for push notifications
   * @param userId - User ID
   * @param deviceToken - FCM device token
   * @param deviceType - Type of device
   * @param deviceInfo - Additional device information
   * @returns Created/updated device
   */
  async registerDevice(
    userId: ObjectId,
    deviceToken: string,
    deviceType: DeviceType,
    deviceInfo?: any
  ): Promise<IPushNotificationDevice> {
    try {
      const device = await PushNotificationDevice.findOneAndUpdate(
        {
          user_id: userId,
          device_token: deviceToken
        },
        {
          $set: {
            user_id: userId,
            device_token: deviceToken,
            device_type: deviceType,
            device_info: deviceInfo || {},
            is_active: true,
            last_used_at: new Date(),
            updated_at: new Date()
          },
          $setOnInsert: {
            created_at: new Date()
          }
        },
        {
          upsert: true,
          new: true
        }
      );

      this.logger.info('Device registered for push notifications', {
        user_id: userId,
        device_token: deviceToken.substring(0, 20) + '...',
        device_type: deviceType,
        device_id: device._id
      });

      return device;

    } catch (error) {
      this.logger.error('Failed to register device', {
        user_id: userId,
        device_token: deviceToken.substring(0, 20) + '...',
        device_type: deviceType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Remove a device from push notifications
   * @param userId - User ID
   * @param deviceToken - FCM device token
   */
  async removeDevice(userId: ObjectId, deviceToken: string): Promise<void> {
    try {
      const device = await PushNotificationDevice.findOne({
        user_id: userId,
        device_token: deviceToken
      });

      if (device) {
        await device.deactivate();
        
        this.logger.info('Device removed from push notifications', {
          user_id: userId,
          device_token: deviceToken.substring(0, 20) + '...',
          device_id: device._id
        });
      } else {
        this.logger.warn('Device not found for removal', {
          user_id: userId,
          device_token: deviceToken.substring(0, 20) + '...'
        });
      }

    } catch (error) {
      this.logger.error('Failed to remove device', {
        user_id: userId,
        device_token: deviceToken.substring(0, 20) + '...',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get all active devices for a user
   * @param userId - User ID
   * @returns Array of active devices
   */
  async getUserDevices(userId: ObjectId): Promise<IPushNotificationDevice[]> {
    try {
      const devices = await PushNotificationDevice.find({
        user_id: userId,
        is_active: true
      }).sort({ last_used_at: -1 });

      this.logger.info('Retrieved user devices', {
        user_id: userId,
        device_count: devices.length
      });

      return devices;

    } catch (error) {
      this.logger.error('Failed to get user devices', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Cleanup inactive devices (scheduled task)
   * @param daysInactive - Days of inactivity before cleanup (default 90)
   * @returns Number of devices cleaned up
   */
  async cleanupInactiveDevices(daysInactive: number = 90): Promise<number> {
    try {
      const cleanedCount = await PushNotificationDevice.cleanupInactive(daysInactive);

      this.logger.info('Inactive device cleanup completed', {
        days_inactive: daysInactive,
        cleaned_count: cleanedCount
      });

      return cleanedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup inactive devices', {
        days_inactive: daysInactive,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Build push notification payload
   * @private
   * @param notification - Notification object
   * @param user - User object
   * @returns Push payload
   */
  private buildPushPayload(notification: INotification, user: any): PushPayload {
    const isUrgent = notification.priority === NotificationPriority.URGENT;
    
    return {
      notification: {
        title: notification.title,
        body: notification.message,
        icon: '/icons/notification-icon.png',
        badge: '/icons/badge-icon.png',
        tag: notification._id?.toString() || '',
        requireInteraction: isUrgent
      },
      data: {
        notification_id: notification._id?.toString() || '',
        related_entity: JSON.stringify(notification.related_entity),
        url: `/app/${notification.related_entity.entity_type}/${notification.related_entity.entity_id}`,
        timestamp: new Date().toISOString(),
        priority: notification.priority
      }
    };
  }

  /**
   * Send push notification to a specific device
   * @private
   * @param deviceToken - FCM device token
   * @param payload - Push notification payload
   */
  private async sendToDevice(deviceToken: string, payload: PushPayload): Promise<void> {
    if (!this.messaging) {
      throw new Error('Firebase messaging not initialized');
    }

    const message = {
      token: deviceToken,
      notification: payload.notification,
      data: payload.data,
      android: {
        priority: payload.data.priority === 'urgent' ? 'high' : 'normal',
        notification: {
          sound: 'default',
          channelId: 'task_notifications'
        }
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
            'content-available': 1
          }
        }
      },
      webpush: {
        notification: payload.notification,
        fcmOptions: {
          link: payload.data.url
        }
      }
    };

    const response = await this.messaging.send(message);
    
    this.logger.info('FCM send response', {
      device_token: deviceToken.substring(0, 20) + '...',
      response: response
    });
  }

  /**
   * Get active devices for user
   * @private
   * @param userId - User ID
   * @returns Array of active devices
   */
  private async getUserActiveDevices(userId: string): Promise<IPushNotificationDevice[]> {
    return await PushNotificationDevice.find({
      user_id: new ObjectId(userId),
      is_active: true
    });
  }

  /**
   * Handle device-specific errors
   * @private
   * @param device - Device that failed
   * @param error - Error that occurred
   */
  private async handleDeviceError(device: IPushNotificationDevice, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle common FCM errors
    if (errorMessage.includes('registration-token-not-registered') ||
        errorMessage.includes('invalid-registration-token')) {
      // Invalid or expired token - deactivate device
      await device.deactivate();
      
      this.logger.warn('Device deactivated due to invalid token', {
        device_id: device._id,
        user_id: device.user_id,
        device_token: device.device_token.substring(0, 20) + '...',
        error: errorMessage
      });
      
    } else if (errorMessage.includes('message-rate-exceeded') ||
               errorMessage.includes('quota-exceeded')) {
      // Rate limiting - don't deactivate, just log
      this.logger.warn('FCM rate limit exceeded', {
        device_id: device._id,
        user_id: device.user_id,
        error: errorMessage
      });
      
    } else {
      // Other errors - log but don't deactivate
      this.logger.error('Unhandled FCM error', {
        device_id: device._id,
        user_id: device.user_id,
        device_token: device.device_token.substring(0, 20) + '...',
        error: errorMessage
      });
    }
  }

  /**
   * Initialize Firebase Admin SDK
   * @private
   * @param firebaseAdmin - Firebase Admin SDK
   */
  private initializeFirebase(firebaseAdmin: FirebaseAdmin): void {
    const credentialsJson = process.env.FIREBASE_CREDENTIALS_JSON;
    
    if (!credentialsJson) {
      throw new Error('FIREBASE_CREDENTIALS_JSON environment variable is required');
    }

    let serviceAccount;
    try {
      // Try to parse as JSON string first
      serviceAccount = JSON.parse(credentialsJson);
    } catch (error) {
      // If parsing fails, assume it's a file path
      try {
        serviceAccount = require(credentialsJson);
      } catch (fileError) {
        throw new Error(`Failed to load Firebase credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    this.firebaseApp = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });

    this.messaging = this.firebaseApp.messaging();

    this.logger.info('Firebase Admin SDK initialized successfully', {
      project_id: serviceAccount.project_id
    });
  }

  /**
   * Test push notification functionality
   * @param deviceToken - Test device token
   * @returns True if test successful
   */
  async testPushNotification(deviceToken: string): Promise<boolean> {
    if (!this.isEnabled || !this.messaging) {
      return false;
    }

    try {
      const testPayload: PushPayload = {
        notification: {
          title: 'Test Notification',
          body: 'This is a test push notification',
          icon: '/icons/notification-icon.png',
          tag: 'test'
        },
        data: {
          notification_id: 'test',
          related_entity: '{}',
          url: '/app/test',
          timestamp: new Date().toISOString(),
          priority: 'normal'
        }
      };

      await this.sendToDevice(deviceToken, testPayload);
      return true;
      
    } catch (error) {
      this.logger.error('Push notification test failed', {
        device_token: deviceToken.substring(0, 20) + '...',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get push notification statistics
   * @returns Push notification stats
   */
  async getStats(): Promise<{
    isEnabled: boolean;
    totalActiveDevices: number;
    devicesByType: Record<string, number>;
  }> {
    try {
      const devices = await PushNotificationDevice.find({ is_active: true });
      
      const devicesByType: Record<string, number> = {};
      devices.forEach(device => {
        devicesByType[device.device_type] = (devicesByType[device.device_type] || 0) + 1;
      });

      return {
        isEnabled: this.isEnabled,
        totalActiveDevices: devices.length,
        devicesByType
      };

    } catch (error) {
      this.logger.error('Failed to get push notification stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        isEnabled: this.isEnabled,
        totalActiveDevices: 0,
        devicesByType: {}
      };
    }
  }
}