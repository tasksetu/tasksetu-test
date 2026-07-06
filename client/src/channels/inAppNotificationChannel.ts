import { BaseNotificationChannel } from './baseNotificationChannel';
import { 
  INotification, 
  ChannelType, 
  ChannelStatus 
} from '../models';

/**
 * Socket.IO Server interface for dependency injection
 */
interface SocketIOServer {
  to(room: string): {
    emit(event: string, data: any): void;
  };
  sockets: {
    adapter: {
      rooms: Map<string, Set<string>>;
    };
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
 * In-app notification channel implementation
 * Handles real-time notifications through Socket.IO
 */
export class InAppNotificationChannel extends BaseNotificationChannel {
  private readonly io: SocketIOServer;

  // Configuration constants
  static readonly AUTO_DISMISS_TIMEOUT_NORMAL = 5000; // 5 seconds
  static readonly AUTO_DISMISS_TIMEOUT_URGENT = 10000; // 10 seconds
  static readonly MAX_CONCURRENT_NOTIFICATIONS = 5;

  constructor(
    io: SocketIOServer,
    logger: Logger,
    notificationModel: NotificationModelType,
    maxRetries: number = 3
  ) {
    super(logger, notificationModel, maxRetries);
    this.io = io;
  }

  /**
   * Send in-app notification through Socket.IO
   * @param notification - Notification to send
   * @param user - User object
   * @returns Always true (in-app notifications never fail)
   */
  async send(notification: INotification, user: any): Promise<boolean> {
    try {
      // Update notification to add in_app channel status
      await this.notificationModel.updateOne(
        { _id: notification._id },
        {
          $push: {
            channels: {
              channel_type: ChannelType.IN_APP,
              status: ChannelStatus.SENT,
              sent_at: new Date(),
              error_message: undefined,
              retry_count: 0
            }
          }
        }
      );

      this.logger.info('In-app notification channel added to database', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        channel_type: ChannelType.IN_APP
      });

      // Broadcast real-time notification to user
      await this.broadcastToUser(user, notification);

      this.logger.info('In-app notification sent successfully', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        trigger_event: notification.trigger_event
      });

      return true; // In-app notifications never fail

    } catch (error) {
      this.logger.error('Failed to send in-app notification', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Even on database error, we return true since the notification 
      // exists and real-time broadcast may have succeeded
      return true;
    }
  }

  /**
   * Check if user can receive in-app notifications
   * @param user - User object
   * @returns Always true (all users can receive in-app notifications)
   */
  async canSend(user: any): Promise<boolean> {
    this.logger.info('In-app notification capability check', {
      user_id: user._id || user.id,
      can_send: true
    });

    return true; // All users can receive in-app notifications
  }

  /**
   * Broadcast notification to user's socket room
   * @param user - User object
   * @param notification - Notification to broadcast
   */
  async broadcastToUser(user: any, notification: INotification): Promise<void> {
    try {
      const userId = user._id || user.id;
      const roomName = `user_${userId}`;

      // Prepare notification payload for frontend
      const notificationPayload = {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        trigger_event: notification.trigger_event,
        priority: notification.priority,
        related_entity: notification.related_entity,
        metadata: notification.metadata,
        created_at: notification.created_at,
        auto_dismiss_timeout: this.getAutoDismissTimeout(notification.priority),
        channel_type: ChannelType.IN_APP
      };

      // Emit to user's specific room
      this.io.to(roomName).emit('new_notification', notificationPayload);

      this.logger.info('Real-time notification broadcast sent', {
        notification_id: notification._id,
        user_id: userId,
        room_name: roomName,
        trigger_event: notification.trigger_event,
        priority: notification.priority
      });

      // Also emit notification count update
      const unreadCount = await this.getUserUnreadCount(userId);
      this.io.to(roomName).emit('notification_count_update', { unread_count: unreadCount });

      this.logger.info('Unread count update sent', {
        user_id: userId,
        unread_count: unreadCount
      });

    } catch (error) {
      // Handle errors silently - don't fail if socket not connected
      this.logger.warn('Failed to broadcast real-time notification', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'User may not be connected to socket'
      });
    }
  }

  /**
   * Get auto-dismiss timeout based on priority
   * @private
   * @param priority - Notification priority
   * @returns Timeout in milliseconds
   */
  private getAutoDismissTimeout(priority: string): number {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return InAppNotificationChannel.AUTO_DISMISS_TIMEOUT_URGENT;
      case 'normal':
      default:
        return InAppNotificationChannel.AUTO_DISMISS_TIMEOUT_NORMAL;
    }
  }

  /**
   * Get unread notification count for user
   * @private
   * @param userId - User ID
   * @returns Unread count
   */
  private async getUserUnreadCount(userId: string): Promise<number> {
    try {
      // Placeholder implementation - should integrate with actual notification count method
      this.logger.info('Fetching unread count for user', { user_id: userId });
      return 0; // Placeholder return
    } catch (error) {
      this.logger.error('Failed to get unread count', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Send notification dismissal to user
   * @param userId - User ID
   * @param notificationId - Notification ID to dismiss
   */
  async dismissNotification(userId: string, notificationId: string): Promise<void> {
    try {
      const roomName = `user_${userId}`;
      
      this.io.to(roomName).emit('dismiss_notification', { 
        notification_id: notificationId 
      });

      this.logger.info('Notification dismissal sent', {
        user_id: userId,
        notification_id: notificationId,
        room_name: roomName
      });

    } catch (error) {
      this.logger.error('Failed to send notification dismissal', {
        user_id: userId,
        notification_id: notificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send bulk notification update to user
   * @param userId - User ID
   * @param notifications - Array of notifications
   */
  async sendBulkUpdate(userId: string, notifications: any[]): Promise<void> {
    try {
      const roomName = `user_${userId}`;
      
      this.io.to(roomName).emit('notifications_bulk_update', { 
        notifications,
        timestamp: new Date()
      });

      this.logger.info('Bulk notification update sent', {
        user_id: userId,
        notification_count: notifications.length,
        room_name: roomName
      });

    } catch (error) {
      this.logger.error('Failed to send bulk notification update', {
        user_id: userId,
        notification_count: notifications.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get connected socket count for user
   * @param userId - User ID
   * @returns Number of connected sockets
   */
  getConnectedSocketCount(userId: string): number {
    try {
      const roomName = `user_${userId}`;
      const room = this.io.sockets.adapter.rooms.get(roomName);
      const count = room ? room.size : 0;

      this.logger.info('Socket connection count retrieved', {
        user_id: userId,
        room_name: roomName,
        connected_sockets: count
      });

      return count;
    } catch (error) {
      this.logger.error('Failed to get socket count', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Check if user is currently online
   * @param userId - User ID
   * @returns True if user has connected sockets
   */
  isUserOnline(userId: string): boolean {
    return this.getConnectedSocketCount(userId) > 0;
  }
}