import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';
import { 
  INotification,
  UserNotificationPreference,
  NotificationSuppressionRule,
  TriggerEvent,
  NotificationPriority,
  ChannelType,
  ChannelStatus
} from '../models';
import { NotificationTriggerConfig } from '../config/notificationTriggerConfig';

/**
 * Simple notification channel interface for dependency injection
 */
interface NotificationChannel {
  send(notification: INotification, user: any): Promise<void>;
}

/**
 * Notification channel factory interface
 */
interface NotificationChannelFactory {
  getChannel(channelType: ChannelType): NotificationChannel;
}

/**
 * Notification model interface for dependency injection
 */
interface NotificationModelType extends Model<INotification> {
  getUnreadCount(userId: ObjectId): Promise<number>;
}

/**
 * Data transfer object for creating notifications
 */
export interface CreateNotificationDto {
  user_id: ObjectId;
  trigger_event: TriggerEvent;
  related_entity: {
    entity_type: string;
    entity_id: ObjectId;
  };
  priority?: NotificationPriority;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  expires_at?: Date;
}

/**
 * Filters for querying notifications
 */
export interface NotificationFilters {
  is_read?: boolean;
  priority?: NotificationPriority;
  trigger_event?: TriggerEvent;
}

/**
 * Pagination options for queries
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated result structure
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  unread_count?: number;
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
 * Comprehensive notification service for managing all notification operations
 */
class NotificationService {
  private readonly channelFactory: NotificationChannelFactory;
  private readonly logger: Logger;
  private readonly notificationModel: NotificationModelType;

  constructor(
    channelFactory: NotificationChannelFactory, 
    logger: Logger,
    notificationModel: NotificationModelType
  ) {
    this.channelFactory = channelFactory;
    this.logger = logger;
    this.notificationModel = notificationModel;
  }

  /**
   * Create a new notification
   * @param data - Notification creation data
   * @returns Created notification
   */
  async createNotification(data: CreateNotificationDto): Promise<INotification> {
    try {
      // Check for duplicate suppression
      const shouldSuppress = await this.suppressDuplicates(
        data.trigger_event,
        data.user_id,
        data.related_entity.entity_id
      );

      if (shouldSuppress) {
        const error = `Notification suppressed for user ${data.user_id}, trigger: ${data.trigger_event}`;
        this.logger.info(error);
        throw new Error(error);
      }

      // Create notification document
      const notificationData = {
        user_id: data.user_id,
        trigger_event: data.trigger_event,
        related_entity: data.related_entity,
        priority: data.priority || NotificationPriority.NORMAL,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
        expires_at: data.expires_at,
        is_read: false,
        channels: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      const savedNotification = await this.notificationModel.create(notificationData);

      this.logger.info('Notification created successfully', {
        notification_id: savedNotification._id,
        user_id: data.user_id,
        trigger_event: data.trigger_event
      });

      // Send notification asynchronously (don't block the response)
      this.sendNotification(savedNotification).catch((error) => {
        this.logger.error('Failed to send notification', {
          notification_id: savedNotification._id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });

      return savedNotification;
    } catch (error) {
      this.logger.error('Failed to create notification', {
        user_id: data.user_id,
        trigger_event: data.trigger_event,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Send notification through enabled channels
   * @param notification - Notification to send
   */
  async sendNotification(notification: INotification): Promise<void> {
    try {
      // Get user data
      const user = await this.getUserById(notification.user_id as any);
      if (!user) {
        throw new Error(`User not found: ${notification.user_id}`);
      }

      // Get user preferences
      const preferences = await UserNotificationPreference.findOne({
        user_id: notification.user_id
      });

      // Determine enabled channels
      const enabledChannels = await this.getEnabledChannels(
        notification.trigger_event,
        preferences
      );

      if (enabledChannels.length === 0) {
        this.logger.info('No enabled channels for notification', {
          notification_id: notification._id,
          user_id: notification.user_id
        });
        return;
      }

      // Send through each enabled channel
      for (const channelType of enabledChannels) {
        try {
          // Add channel to notification with pending status
          notification.channels.push({
            channel_type: channelType,
            status: ChannelStatus.PENDING,
            sent_at: undefined,
            error_message: undefined,
            retry_count: 0
          });

          // Get channel handler
          const channel = this.channelFactory.getChannel(channelType);
          
          // Send notification
          await channel.send(notification, user);

          // Update channel status to sent
          const channelIndex = notification.channels.findIndex(
            c => c.channel_type === channelType && c.status === 'pending'
          );
          if (channelIndex !== -1) {
            notification.channels[channelIndex].status = ChannelStatus.SENT;
            notification.channels[channelIndex].sent_at = new Date();
          }

          this.logger.info('Notification sent successfully', {
            notification_id: notification._id,
            channel_type: channelType,
            user_id: notification.user_id
          });

        } catch (channelError) {
          // Update channel status to failed
          const channelIndex = notification.channels.findIndex(
            c => c.channel_type === channelType && c.status === 'pending'
          );
          if (channelIndex !== -1) {
            notification.channels[channelIndex].status = ChannelStatus.FAILED;
            notification.channels[channelIndex].error_message = 
              channelError instanceof Error ? channelError.message : 'Unknown error';
          }

          this.logger.error('Failed to send notification through channel', {
            notification_id: notification._id,
            channel_type: channelType,
            user_id: notification.user_id,
            error: channelError instanceof Error ? channelError.message : 'Unknown error'
          });
        }
      }

      // Save updated notification with channel statuses
      await notification.save();

    } catch (error) {
      this.logger.error('Failed to send notification', {
        notification_id: notification._id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get recipients for a trigger event based on related entity
   * @param triggerEvent - The trigger event
   * @param relatedEntity - Related entity information
   * @returns Array of user IDs
   */
  async getRecipients(
    triggerEvent: TriggerEvent, 
    relatedEntity: { entity_type: string; entity_id: ObjectId }
  ): Promise<ObjectId[]> {
    try {
      const config = NotificationTriggerConfig.getConfig(triggerEvent);
      const recipientRoles = config.default_recipient_roles;
      const recipients = new Set<string>();

      // Fetch related entity based on type
      switch (relatedEntity.entity_type.toLowerCase()) {
        case 'task': {
          const task = await this.getTaskById(relatedEntity.entity_id);
          if (!task) break;

          if (recipientRoles.includes('creator')) {
            recipients.add(task.created_by?.toString());
          }
          if (recipientRoles.includes('assignee')) {
            recipients.add(task.assigned_to?.toString());
          }
          if (recipientRoles.includes('manager')) {
            recipients.add(task.manager_id?.toString());
          }
          if (recipientRoles.includes('collaborator') && task.collaborators) {
            task.collaborators.forEach((id: ObjectId) => {
              recipients.add(id.toString());
            });
          }
          break;
        }

        case 'approval': {
          // Placeholder for approval entity - implement based on your Approval model
          // const approval = await this.getApprovalById(relatedEntity.entity_id);
          // if (recipientRoles.includes('approver')) recipients.add(approval.approver_id?.toString());
          // if (recipientRoles.includes('creator')) recipients.add(approval.requester_id?.toString());
          break;
        }

        case 'comment': {
          // Placeholder for comment entity - implement based on your Comment model
          // const comment = await this.getCommentById(relatedEntity.entity_id);
          // if (recipientRoles.includes('mentioned_user')) {
          //   const mentions = this.parseMentions(comment.content);
          //   mentions.forEach(userId => recipients.add(userId.toString()));
          // }
          break;
        }

        default:
          this.logger.warn('Unknown entity type for recipient resolution', {
            entity_type: relatedEntity.entity_type,
            trigger_event: triggerEvent
          });
      }

      // Remove null/undefined values and convert back to ObjectIds
      const uniqueRecipients = Array.from(recipients)
        .filter(id => id && id !== 'undefined')
        .map(id => new ObjectId(id));

      return uniqueRecipients;

    } catch (error) {
      this.logger.error('Failed to get recipients', {
        trigger_event: triggerEvent,
        related_entity: relatedEntity,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Check if notification should be sent to user for specific channel
   * @param user - User object
   * @param triggerEvent - Trigger event
   * @param channelType - Channel type
   * @returns True if should send
   */
  async shouldSendNotification(
    user: any, 
    triggerEvent: TriggerEvent, 
    channelType: ChannelType
  ): Promise<boolean> {
    try {
      const preferences = await UserNotificationPreference.findOne({
        user_id: user._id
      });

      if (!preferences) {
        // Default to enabled if no preferences found
        return true;
      }

      return preferences.isChannelEnabled(triggerEvent, channelType);

    } catch (error) {
      this.logger.error('Failed to check notification permissions', {
        user_id: user._id,
        trigger_event: triggerEvent,
        channel_type: channelType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Default to enabled on error to avoid blocking important notifications
      return true;
    }
  }

  /**
   * Check if notification should be suppressed due to recent similar notifications
   * @param triggerEvent - Trigger event
   * @param userId - User ID
   * @param relatedEntityId - Related entity ID
   * @returns True if should suppress
   */
  async suppressDuplicates(
    triggerEvent: TriggerEvent,
    userId: ObjectId,
    relatedEntityId: ObjectId
  ): Promise<boolean> {
    try {
      // Get suppression rule
      const suppressionRule = await NotificationSuppressionRule.findOne({
        trigger_event: triggerEvent,
        is_active: true
      });

      if (!suppressionRule) {
        return false; // No suppression rule found
      }

      // Calculate window start time
      const windowStart = new Date();
      windowStart.setMinutes(windowStart.getMinutes() - suppressionRule.suppression_window_minutes);

      // Check for recent notifications
      const recentNotification = await this.notificationModel.findOne({
        user_id: userId,
        trigger_event: triggerEvent,
        'related_entity.entity_id': relatedEntityId,
        created_at: { $gte: windowStart },
        deleted_at: null
      });

      return !!recentNotification;

    } catch (error) {
      this.logger.error('Failed to check notification suppression', {
        trigger_event: triggerEvent,
        user_id: userId,
        related_entity_id: relatedEntityId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't suppress on error to avoid blocking important notifications
      return false;
    }
  }

  /**
   * Get paginated notifications for a user
   * @param userId - User ID
   * @param filters - Query filters
   * @param pagination - Pagination options
   * @returns Paginated notifications
   */
  async getNotifications(
    userId: ObjectId,
    filters: NotificationFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<INotification>> {
    try {
      // Build query
      const query: any = {
        user_id: userId,
        deleted_at: null
      };

      if (filters.is_read !== undefined) {
        query.is_read = filters.is_read;
      }
      if (filters.priority) {
        query.priority = filters.priority;
      }
      if (filters.trigger_event) {
        query.trigger_event = filters.trigger_event;
      }

      // Calculate skip
      const skip = (pagination.page - 1) * pagination.limit;

      // Execute parallel queries
      const [notifications, total, unreadCount] = await Promise.all([
        this.notificationModel.find(query)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(pagination.limit)
          .lean(),
        this.notificationModel.countDocuments(query),
        this.getUnreadCount(userId)
      ]);

      const pages = Math.ceil(total / pagination.limit);

      return {
        data: notifications as any[],
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages
        },
        unread_count: unreadCount
      };

    } catch (error) {
      this.logger.error('Failed to get notifications', {
        user_id: userId,
        filters,
        pagination,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param notificationId - Notification ID
   * @param userId - User ID for security check
   */
  async markAsRead(notificationId: ObjectId, userId: ObjectId): Promise<void> {
    try {
      const result = await this.notificationModel.updateOne(
        { _id: notificationId, user_id: userId },
        { 
          is_read: true, 
          read_at: new Date(),
          updated_at: new Date()
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Notification not found or access denied');
      }

      this.logger.info('Notification marked as read', {
        notification_id: notificationId,
        user_id: userId
      });

    } catch (error) {
      this.logger.error('Failed to mark notification as read', {
        notification_id: notificationId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param userId - User ID
   * @returns Number of notifications marked as read
   */
  async markAllAsRead(userId: ObjectId): Promise<number> {
    try {
      const result = await this.notificationModel.updateMany(
        { 
          user_id: userId, 
          is_read: false, 
          deleted_at: null 
        },
        { 
          is_read: true, 
          read_at: new Date(),
          updated_at: new Date()
        }
      );

      this.logger.info('All notifications marked as read', {
        user_id: userId,
        count: result.modifiedCount
      });

      return result.modifiedCount;

    } catch (error) {
      this.logger.error('Failed to mark all notifications as read', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   * @param userId - User ID
   * @returns Unread count
   */
  async getUnreadCount(userId: ObjectId): Promise<number> {
    try {
      return await this.notificationModel.getUnreadCount(userId);
    } catch (error) {
      this.logger.error('Failed to get unread count', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Soft delete a notification
   * @param notificationId - Notification ID
   * @param userId - User ID for security check
   */
  async deleteNotification(notificationId: ObjectId, userId: ObjectId): Promise<void> {
    try {
      const result = await this.notificationModel.updateOne(
        { _id: notificationId, user_id: userId },
        { 
          deleted_at: new Date(),
          updated_at: new Date()
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Notification not found or access denied');
      }

      this.logger.info('Notification deleted', {
        notification_id: notificationId,
        user_id: userId
      });

    } catch (error) {
      this.logger.error('Failed to delete notification', {
        notification_id: notificationId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  /**
   * Get enabled channels for a trigger event based on user preferences
   * @private
   * @param triggerEvent - Trigger event
   * @param preferences - User preferences
   * @returns Array of enabled channel types
   */
  private async getEnabledChannels(
    triggerEvent: TriggerEvent, 
    preferences: any
  ): Promise<ChannelType[]> {
    try {
      if (!preferences) {
        // Return default channels from config if no preferences
        return NotificationTriggerConfig.getDefaultChannels(triggerEvent);
      }

      const allChannels = Object.values(ChannelType);
      const enabledChannels: ChannelType[] = [];

      for (const channel of allChannels) {
        if (await this.shouldSendNotification({ _id: preferences.user_id }, triggerEvent, channel)) {
          enabledChannels.push(channel);
        }
      }

      return enabledChannels;

    } catch (error) {
      this.logger.error('Failed to get enabled channels', {
        trigger_event: triggerEvent,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Return default channels on error
      return NotificationTriggerConfig.getDefaultChannels(triggerEvent);
    }
  }

  /**
   * Get user by ID
   * @private
   * @param userId - User ID
   * @returns User object or null
   */
  private async getUserById(userId: ObjectId): Promise<any> {
    try {
      // Placeholder - implement based on your User model
      // return await User.findById(userId);
      this.logger.warn('getUserById not implemented - using placeholder', { userId });
      return { _id: userId, email: 'placeholder@example.com' };
    } catch (error) {
      this.logger.error('Failed to get user by ID', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get task by ID
   * @private
   * @param taskId - Task ID
   * @returns Task object or null
   */
  private async getTaskById(taskId: ObjectId): Promise<any> {
    try {
      // Placeholder - implement based on your Task model
      // return await Task.findById(taskId);
      this.logger.warn('getTaskById not implemented - using placeholder', { taskId });
      return { 
        _id: taskId, 
        created_by: new ObjectId(), 
        assigned_to: new ObjectId(),
        manager_id: new ObjectId(),
        collaborators: []
      };
    } catch (error) {
      this.logger.error('Failed to get task by ID', {
        task_id: taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
}

export { NotificationService };