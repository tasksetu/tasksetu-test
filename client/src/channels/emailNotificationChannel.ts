import { BaseNotificationChannel } from './baseNotificationChannel';
import { 
  INotification, 
  ChannelType, 
  ChannelStatus,
  NotificationPriority,
  NotificationDigestQueue
} from '../models';
import { 
  generateEmailTemplate, 
  generateTextTemplate, 
  EmailTemplateData 
} from '../templates/emailTemplate';

/**
 * Email configuration interface
 */
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    address: string;
    name: string;
  };
}

/**
 * Nodemailer transporter interface
 */
interface Transporter {
  sendMail(options: any): Promise<any>;
  verify(): Promise<boolean>;
}

/**
 * Nodemailer interface for dependency injection
 */
interface Nodemailer {
  createTransporter(config: any): Transporter;
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
 * Email notification channel implementation
 * Handles email delivery with SMTP configuration and batching
 */
export class EmailNotificationChannel extends BaseNotificationChannel {
  private transporter: Transporter;
  private emailConfig: EmailConfig;
  private retryAttempts: number;
  private retryDelaySeconds: number;
  private batchNonUrgent: boolean;
  private appUrl: string;
  private appName: string;

  constructor(
    nodemailer: Nodemailer,
    logger: Logger,
    notificationModel: NotificationModelType,
    maxRetries: number = 3
  ) {
    super(logger, notificationModel, maxRetries);
    
    // Initialize properties with defaults
    this.emailConfig = {
      host: 'localhost',
      port: 587,
      secure: false,
      auth: { user: '', pass: '' },
      from: { address: 'noreply@example.com', name: 'Admin Task Manager' }
    };
    this.retryAttempts = 3;
    this.retryDelaySeconds = 300;
    this.batchNonUrgent = true;
    this.appUrl = 'http://localhost:3000';
    this.appName = 'Admin Task Manager';
    
    // Load configuration from environment variables
    this.loadEmailConfig();
    
    // Initialize transporter
    this.transporter = nodemailer.createTransporter({
      host: this.emailConfig.host,
      port: this.emailConfig.port,
      secure: this.emailConfig.secure,
      auth: {
        user: this.emailConfig.auth.user,
        pass: this.emailConfig.auth.pass
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10
    });

    // Verify SMTP connection
    this.verifyConnection();
  }

  /**
   * Send email notification
   * @param notification - Notification to send
   * @param user - User object
   * @returns True if sent successfully
   */
  async send(notification: INotification, user: any): Promise<boolean> {
    try {
      // Check if user has email address
      if (!user.email || user.email.trim() === '') {
        this.logger.warn('Cannot send email - user has no email address', {
          notification_id: notification._id,
          user_id: user._id || user.id
        });
        await this.logChannelStatus(
          notification._id as any,
          ChannelType.EMAIL,
          ChannelStatus.FAILED,
          'User has no email address'
        );
        return false;
      }

      // Check if email should be batched
      if (this.shouldBatch(notification)) {
        await this.addToDigestQueue(notification, user);
        this.logger.info('Email notification added to digest queue', {
          notification_id: notification._id,
          user_id: user._id || user.id,
          user_email: user.email
        });
        return true;
      }

      // Send immediate email
      return await this.sendImmediateEmail(notification, user);

    } catch (error) {
      this.logger.error('Failed to process email notification', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await this.logChannelStatus(
        notification._id as any,
        ChannelType.EMAIL,
        ChannelStatus.FAILED,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return false;
    }
  }

  /**
   * Check if user can receive email notifications
   * @param user - User object
   * @returns True if can send email
   */
  async canSend(user: any): Promise<boolean> {
    try {
      // Basic email validation
      if (!user.email || user.email.trim() === '') {
        return false;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user.email)) {
        this.logger.warn('Invalid email format', {
          user_id: user._id || user.id,
          email: user.email
        });
        return false;
      }

      // Check email verification status if applicable
      if (user.email_verified !== undefined && !user.email_verified) {
        this.logger.info('Email not verified, cannot send', {
          user_id: user._id || user.id,
          email: user.email
        });
        return false;
      }

      // Optionally ping SMTP server
      try {
        await this.verifyConnection();
        return true;
      } catch (error) {
        this.logger.error('SMTP server not available', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
      }

    } catch (error) {
      this.logger.error('Failed to check email capability', {
        user_id: user._id || user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Send immediate email (non-batched)
   * @private
   * @param notification - Notification to send
   * @param user - User object
   * @returns True if sent successfully
   */
  private async sendImmediateEmail(notification: INotification, user: any): Promise<boolean> {
    try {
      // Prepare message content
      const messageData = await this.prepareMessage(notification, user);
      
      // Generate action URL
      const actionUrl = this.generateActionUrl(notification);
      
      // Generate unsubscribe URL
      const unsubscribeUrl = this.generateUnsubscribeUrl(user._id || user.id);

      // Prepare template data
      const templateData: EmailTemplateData = {
        title: messageData.title,
        message: messageData.message,
        user: {
          name: user.name || user.email.split('@')[0],
          email: user.email
        },
        notification: notification,
        actionUrl: actionUrl,
        unsubscribeUrl: unsubscribeUrl,
        appName: this.appName,
        appUrl: this.appUrl
      };

      // Generate email content
      const htmlContent = generateEmailTemplate(templateData);
      const textContent = generateTextTemplate(templateData);

      // Send email
      await this.sendEmail(
        user.email,
        messageData.title,
        htmlContent,
        textContent,
        notification
      );

      // Log success
      await this.logChannelStatus(
        notification._id as any,
        ChannelType.EMAIL,
        ChannelStatus.SENT
      );

      this.logger.info('Email notification sent successfully', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        user_email: user.email,
        trigger_event: notification.trigger_event
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to send immediate email', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        user_email: user.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Log failure
      await this.logChannelStatus(
        notification._id as any,
        ChannelType.EMAIL,
        ChannelStatus.FAILED,
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Check if should retry
      if (await this.shouldRetry(notification, ChannelType.EMAIL)) {
        // Queue retry (implementation depends on your job queue system)
        this.logger.info('Queuing email retry', {
          notification_id: notification._id,
          user_email: user.email,
          retry_delay: this.retryDelaySeconds
        });
        // TODO: Implement retry queue integration
      }

      return false;
    }
  }

  /**
   * Send email using transporter
   * @private
   * @param to - Recipient email
   * @param subject - Email subject
   * @param htmlContent - HTML content
   * @param textContent - Text content
   * @param notification - Notification object
   */
  private async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
    textContent: string,
    notification: INotification
  ): Promise<void> {
    const mailOptions = {
      from: {
        address: this.emailConfig.from.address,
        name: this.emailConfig.from.name
      },
      to: to,
      subject: subject,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Notification-ID': notification._id?.toString(),
        'X-Trigger-Event': notification.trigger_event,
        'X-Priority': notification.priority
      },
      messageId: `notification-${notification._id}@${this.emailConfig.from.address.split('@')[1]}`,
      date: new Date()
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.info('Email sent successfully', {
        notification_id: notification._id,
        recipient: to,
        message_id: result.messageId,
        response: result.response
      });

    } catch (error) {
      this.logger.error('SMTP send failed', {
        notification_id: notification._id,
        recipient: to,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if notification should be batched
   * @private
   * @param notification - Notification object
   * @returns True if should batch
   */
  private shouldBatch(notification: INotification): boolean {
    // Always send urgent notifications immediately
    if (notification.priority === NotificationPriority.URGENT) {
      return false;
    }

    // If batching is disabled globally, don't batch
    if (!this.batchNonUrgent) {
      return false;
    }

    // Batch normal priority notifications
    return true;
  }

  /**
   * Add notification to digest queue for batching
   * @private
   * @param notification - Notification to queue
   * @param user - User object
   */
  private async addToDigestQueue(notification: INotification, user: any): Promise<void> {
    try {
      // This would integrate with your digest queue system
      // For now, just log the action
      this.logger.info('Adding notification to digest queue', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        user_email: user.email,
        trigger_event: notification.trigger_event
      });

      // TODO: Implement actual digest queue integration
      // await NotificationDigestQueue.addNotification(user._id, notification._id);

    } catch (error) {
      this.logger.error('Failed to add notification to digest queue', {
        notification_id: notification._id,
        user_id: user._id || user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate action URL for notification
   * @private
   * @param notification - Notification object
   * @returns Action URL
   */
  private generateActionUrl(notification: INotification): string {
    const baseUrl = this.appUrl;
    const entityType = notification.related_entity.entity_type;
    const entityId = notification.related_entity.entity_id;

    switch (entityType.toLowerCase()) {
      case 'task':
        return `${baseUrl}/tasks/${entityId}`;
      case 'approval':
        return `${baseUrl}/approvals/${entityId}`;
      case 'comment':
        return `${baseUrl}/tasks/${entityId}#comments`;
      default:
        return `${baseUrl}/notifications`;
    }
  }

  /**
   * Generate unsubscribe URL
   * @private
   * @param userId - User ID
   * @returns Unsubscribe URL
   */
  private generateUnsubscribeUrl(userId: string): string {
    // Generate secure token for unsubscribe (implementation depends on your auth system)
    const token = this.generateSecureToken(userId);
    return `${this.appUrl}/notifications/preferences?token=${token}`;
  }

  /**
   * Generate secure token for unsubscribe
   * @private
   * @param userId - User ID
   * @returns Secure token
   */
  private generateSecureToken(userId: string): string {
    // Placeholder implementation - replace with actual JWT or secure token generation
    return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
  }

  /**
   * Load email configuration from environment variables
   * @private
   */
  private loadEmailConfig(): void {
    this.emailConfig = {
      host: process.env.EMAIL_HOST || 'localhost',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASSWORD || ''
      },
      from: {
        address: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
        name: process.env.EMAIL_FROM_NAME || 'Admin Task Manager'
      }
    };

    this.retryAttempts = parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '3');
    this.retryDelaySeconds = parseInt(process.env.EMAIL_RETRY_DELAY_SECONDS || '300');
    this.batchNonUrgent = process.env.EMAIL_BATCH_NON_URGENT !== 'false';
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';
    this.appName = process.env.APP_NAME || 'Admin Task Manager';

    // Validate required configuration
    if (!this.emailConfig.auth.user || !this.emailConfig.auth.pass) {
      throw new Error('EMAIL_USER and EMAIL_PASSWORD environment variables are required');
    }

    this.logger.info('Email configuration loaded', {
      host: this.emailConfig.host,
      port: this.emailConfig.port,
      secure: this.emailConfig.secure,
      from_address: this.emailConfig.from.address,
      batch_non_urgent: this.batchNonUrgent
    });
  }

  /**
   * Verify SMTP connection
   * @private
   */
  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.info('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error('SMTP connection verification failed', {
        host: this.emailConfig.host,
        port: this.emailConfig.port,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`SMTP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get email configuration (for testing/debugging)
   * @returns Email configuration (without sensitive data)
   */
  getConfig(): Partial<EmailConfig> {
    return {
      host: this.emailConfig.host,
      port: this.emailConfig.port,
      secure: this.emailConfig.secure,
      from: this.emailConfig.from
    };
  }

  /**
   * Test email connectivity
   * @returns True if SMTP server is reachable
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.verifyConnection();
      return true;
    } catch (error) {
      return false;
    }
  }
}