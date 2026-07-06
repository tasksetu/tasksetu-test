import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';
import { INotificationChannel } from './notificationChannel.interface';
import { 
  INotification, 
  ChannelType, 
  ChannelStatus, 
  EntityType 
} from '../models';
import { NotificationTriggerConfig } from '../config/notificationTriggerConfig';
import { 
  NotificationChannelException,
  ChannelSendFailedException 
} from '../exceptions/notificationExceptions';

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
 * Abstract base class for notification channels
 * Provides common functionality and enforces interface compliance
 */
export abstract class BaseNotificationChannel implements INotificationChannel {
  protected readonly logger: Logger;
  protected readonly maxRetries: number;
  protected readonly notificationModel: NotificationModelType;

  constructor(
    logger: Logger, 
    notificationModel: NotificationModelType,
    maxRetries: number = 3
  ) {
    this.logger = logger;
    this.notificationModel = notificationModel;
    this.maxRetries = maxRetries;
  }

  /**
   * Abstract methods that must be implemented by subclasses
   */
  abstract send(notification: INotification, user: any): Promise<boolean>;
  abstract canSend(user: any): Promise<boolean>;

  /**
   * Default retry implementation
   * @param notification - Notification to retry
   * @param channelType - Channel type for retry
   * @returns True if retry was successful
   */
  async retry(notification: INotification, channelType: ChannelType): Promise<boolean> {
    try {
      const canRetry = await this.shouldRetry(notification, channelType);
      
      if (!canRetry) {
        this.logger.warn('Retry attempt blocked - max retries reached', {
          notification_id: notification._id,
          channel_type: channelType,
          max_retries: this.maxRetries
        });
        return false;
      }

      // Increment retry count
      await this.incrementRetryCount(notification._id as ObjectId, channelType);

      // Attempt to send again
      const user = { _id: notification.user_id }; // Minimal user object for retry
      const success = await this.send(notification, user);

      if (success) {
        this.logger.info('Notification retry successful', {
          notification_id: notification._id,
          channel_type: channelType
        });
      }

      return success;

    } catch (error) {
      this.logger.error('Retry attempt failed', {
        notification_id: notification._id,
        channel_type: channelType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Log channel status update to database
   * @protected
   * @param notificationId - Notification ID
   * @param channelType - Channel type
   * @param status - Channel status
   * @param errorMessage - Optional error message
   */
  protected async logChannelStatus(
    notificationId: ObjectId,
    channelType: ChannelType,
    status: ChannelStatus,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateOperation: any = {
        'channels.$.status': status,
        'channels.$.sent_at': new Date()
      };

      if (errorMessage) {
        updateOperation['channels.$.error_message'] = errorMessage;
      }

      await this.notificationModel.updateOne(
        {
          _id: notificationId,
          'channels.channel_type': channelType
        },
        {
          $set: updateOperation
        }
      );

      this.logger.info('Channel status updated', {
        notification_id: notificationId,
        channel_type: channelType,
        status: status,
        has_error: !!errorMessage
      });

    } catch (error) {
      this.logger.error('Failed to update channel status', {
        notification_id: notificationId,
        channel_type: channelType,
        status: status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new NotificationChannelException(
        'Failed to update channel status',
        channelType,
        notificationId.toString(),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Increment retry count for a specific channel
   * @protected
   * @param notificationId - Notification ID
   * @param channelType - Channel type
   */
  protected async incrementRetryCount(
    notificationId: ObjectId,
    channelType: ChannelType
  ): Promise<void> {
    try {
      await this.notificationModel.updateOne(
        {
          _id: notificationId,
          'channels.channel_type': channelType
        },
        {
          $inc: { 'channels.$.retry_count': 1 }
        }
      );

      this.logger.info('Retry count incremented', {
        notification_id: notificationId,
        channel_type: channelType
      });

    } catch (error) {
      this.logger.error('Failed to increment retry count', {
        notification_id: notificationId,
        channel_type: channelType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new NotificationChannelException(
        'Failed to increment retry count',
        channelType,
        notificationId.toString(),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Prepare message content with template data
   * @protected
   * @param notification - Notification object
   * @param user - User object
   * @returns Formatted message data
   */
  protected async prepareMessage(
    notification: INotification, 
    user: any
  ): Promise<Record<string, any>> {
    try {
      let relatedEntityData = {};

      // Fetch related entity data based on entity type
      switch (notification.related_entity.entity_type) {
        case EntityType.TASK:
          relatedEntityData = await this.getTaskData(notification.related_entity.entity_id as any);
          break;
        case EntityType.APPROVAL:
          relatedEntityData = await this.getApprovalData(notification.related_entity.entity_id as any);
          break;
        case EntityType.COMMENT:
          relatedEntityData = await this.getCommentData(notification.related_entity.entity_id as any);
          break;
        default:
          this.logger.warn('Unknown entity type for message preparation', {
            entity_type: notification.related_entity.entity_type,
            notification_id: notification._id
          });
      }

      // Prepare template data
      const templateData = {
        user_name: user.name || user.email || 'User',
        ...relatedEntityData,
        ...notification.metadata
      };

      // Format title and message using trigger config
      const formattedTitle = NotificationTriggerConfig.formatTitle(
        notification.trigger_event,
        templateData
      );

      const formattedMessage = NotificationTriggerConfig.formatMessage(
        notification.trigger_event,
        templateData
      );

      return {
        title: formattedTitle,
        message: formattedMessage,
        templateData,
        relatedEntity: relatedEntityData,
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email
        }
      };

    } catch (error) {
      this.logger.error('Failed to prepare message', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Return fallback message data
      return {
        title: notification.title,
        message: notification.message,
        templateData: {},
        relatedEntity: {},
        user: {
          id: user._id || user.id,
          name: user.name || 'User',
          email: user.email
        }
      };
    }
  }

  /**
   * Check if notification should be retried
   * @protected
   * @param notification - Notification object
   * @param channelType - Channel type
   * @returns True if should retry
   */
  protected async shouldRetry(
    notification: INotification, 
    channelType: ChannelType
  ): Promise<boolean> {
    try {
      const channel = notification.channels.find(
        c => c.channel_type === channelType
      );

      if (!channel) {
        this.logger.warn('Channel not found in notification', {
          notification_id: notification._id,
          channel_type: channelType
        });
        return false;
      }

      const canRetry = channel.retry_count < this.maxRetries;
      
      this.logger.info('Retry check completed', {
        notification_id: notification._id,
        channel_type: channelType,
        retry_count: channel.retry_count,
        max_retries: this.maxRetries,
        can_retry: canRetry
      });

      return canRetry;

    } catch (error) {
      this.logger.error('Failed to check retry eligibility', {
        notification_id: notification._id,
        channel_type: channelType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get maximum retry count
   * @protected
   * @returns Maximum retry count
   */
  protected getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * Get task data for template processing
   * @private
   * @param taskId - Task ID
   * @returns Task data object
   */
  private async getTaskData(taskId: ObjectId): Promise<Record<string, any>> {
    try {
      // Placeholder implementation - replace with actual Task model query
      this.logger.info('Fetching task data for notification', { task_id: taskId });
      
      return {
        task_title: 'Task Title',
        creator_name: 'Creator',
        assignee_name: 'Assignee',
        due_date: new Date(),
        priority: 'Medium',
        status: 'Open'
      };
    } catch (error) {
      this.logger.error('Failed to fetch task data', {
        task_id: taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }

  /**
   * Get approval data for template processing
   * @private
   * @param approvalId - Approval ID
   * @returns Approval data object
   */
  private async getApprovalData(approvalId: ObjectId): Promise<Record<string, any>> {
    try {
      // Placeholder implementation - replace with actual Approval model query
      this.logger.info('Fetching approval data for notification', { approval_id: approvalId });
      
      return {
        approval_type: 'Task Approval',
        requester_name: 'Alice Johnson',
        approver_name: 'Bob Wilson',
        requested_at: new Date(),
        approval_deadline: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to fetch approval data', {
        approval_id: approvalId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }

  /**
   * Get comment data for template processing
   * @private
   * @param commentId - Comment ID
   * @returns Comment data object
   */
  private async getCommentData(commentId: ObjectId): Promise<Record<string, any>> {
    try {
      // Placeholder implementation - replace with actual Comment model query
      this.logger.info('Fetching comment data for notification', { comment_id: commentId });
      
      return {
        comment_excerpt: 'This is a sample comment excerpt...',
        commenter_name: 'Charlie Brown',
        commented_at: new Date(),
        task_title: 'Related Task'
      };
    } catch (error) {
      this.logger.error('Failed to fetch comment data', {
        comment_id: commentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }
}