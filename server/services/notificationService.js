import {
  Notification,
  TriggerEvent,
  EntityType,
  NotificationPriority,
  ChannelType,
  ChannelStatus
} from '../modals/notificationModal.js';
import { NotificationSettings, NotificationFrequency } from '../modals/notificationSettingsModal.js';
import { User } from '../modals/userModal.js';
import Task from '../modals/taskModal.js';
import { emailService } from './emailService.js';
import * as licenseService from './licenseService.js';
import * as whatsappService from './whatsappService.js';

/**
 * Notification Service for managing all notification operations
 * Handles creation, delivery, and management of notifications across different channels
 */
export class NotificationService {

  /**
   * Create a new notification
   * @param {Object} notificationData - The notification data
   * @param {ObjectId} notificationData.user_id - Target user ID
   * @param {string} notificationData.trigger_event - Event that triggered the notification
   * @param {Object} notificationData.related_entity - Related entity information
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.message - Notification message
   * @param {string} notificationData.priority - Notification priority (urgent/normal)
   * @param {Array} notificationData.channels - Array of channel types to send to
   * @param {Object} notificationData.metadata - Additional metadata
   * @param {Date} notificationData.expires_at - Expiration date (optional)
   * @returns {Promise<Notification>} Created notification
   */
  static async createNotification(notificationData) {
    try {
      const {
        user_id,
        trigger_event,
        related_entity,
        title,
        message,
        priority = NotificationPriority.NORMAL,
        channels = [ChannelType.IN_APP],
        metadata = {},
        expires_at = null
      } = notificationData;

      // Validate required fields
      if (!user_id || !trigger_event || !related_entity || !title || !message) {
        throw new Error('Missing required notification fields');
      }

      // Get user and notification settings
      const user = await User.findById(user_id);
      if (!user) {
        throw new Error('User not found');
      }

      console.log(`[NotificationService] Processing notification for user: ${user_id}`);
      console.log(`[NotificationService] Trigger event: ${trigger_event}`);

      const settings = await NotificationSettings.getSettingsForUser(user_id);
      console.log(`[NotificationService] Notifications globally enabled: ${settings.notifications_enabled}`);

      // Check if notifications are globally disabled for user
      if (!settings.notifications_enabled) {
        console.log(`[NotificationService] ❌ Notifications disabled for user ${user_id}, creating suppressed record`);
        // G2 FIX: Still create a suppressed notification record for audit/activity purposes
        const suppressedNotification = new Notification({
          user_id,
          trigger_event,
          related_entity,
          priority,
          title,
          message,
          channels: [{ channel_type: ChannelType.IN_APP, status: ChannelStatus.SUPPRESSED, sent_at: null, error_message: 'Notifications globally disabled by user', retry_count: 0 }],
          metadata: { ...metadata, suppressed: true, suppression_reason: 'notifications_disabled' },
          is_read: true, // Mark as read so it doesn't pollute unread count
          expires_at: expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        await suppressedNotification.save();
        return suppressedNotification;
      }

      // Map trigger event to settings key
      const eventSettingKey = NotificationService.getEventSettingKey(trigger_event);
      console.log(`[NotificationService] Event setting key: ${eventSettingKey}`);

      // Check if this specific event type is enabled
      if (eventSettingKey) {
        const isEnabled = settings.isEventEnabled(eventSettingKey);
        console.log(`[NotificationService] Event '${eventSettingKey}' enabled: ${isEnabled}`);

        // 🔍 DEBUG: Show detailed settings
        console.log(`[NotificationService] 🔍 DEBUG - Event Setting Details:`, {
          eventType: eventSettingKey,
          isEnabled: isEnabled,
          notificationsGloballyEnabled: settings.notifications_enabled,
          eventPreferences: settings.event_preferences,
          eventValue: settings.event_preferences?.[eventSettingKey]
        });

        if (!isEnabled) {
          console.log(`[NotificationService] ❌ Event ${trigger_event} disabled for user ${user_id}, creating suppressed record`);
          // G2 FIX: Still create a suppressed notification record for audit/activity purposes
          const suppressedNotification = new Notification({
            user_id,
            trigger_event,
            related_entity,
            priority,
            title,
            message,
            channels: [{ channel_type: ChannelType.IN_APP, status: ChannelStatus.SUPPRESSED, sent_at: null, error_message: `Event ${eventSettingKey} disabled by user`, retry_count: 0 }],
            metadata: { ...metadata, suppressed: true, suppression_reason: 'event_disabled', disabled_event: eventSettingKey },
            is_read: true,
            expires_at: expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          });
          await suppressedNotification.save();
          return suppressedNotification;
        }
      } else {
        console.log(`[NotificationService] ⚠️ No event setting key found for ${trigger_event}, proceeding anyway`);
      }

      // Validate trigger event
      if (!Object.values(TriggerEvent).includes(trigger_event)) {
        throw new Error(`Invalid trigger event: ${trigger_event}`);
      }

      // Validate entity type
      if (!Object.values(EntityType).includes(related_entity.entity_type)) {
        throw new Error(`Invalid entity type: ${related_entity.entity_type}`);
      }

      // 🔐 LICENSE CHECK: Filter channels based on user's license
      // NOTIF_BASIC: in_app notifications (available to all tiers)
      // NOTIF_ADV: email, push, sms notifications (requires Plan tier or above)
      // WHATSAPP: requires Optimize tier (top license code) or super admin bypass
      let hasAdvancedNotifications = false;
      let isOptimizeTier = false;
      try {
        const advancedAccessCheck = await licenseService.checkFeatureAccess(user_id, 'NOTIF_ADV');
        hasAdvancedNotifications = advancedAccessCheck?.hasAccess === true;
        console.log(`[NotificationService] 🔐 License check NOTIF_ADV for user ${user_id}: ${hasAdvancedNotifications}`);

        // Check if user is super admin to bypass Optimize tier check
        const userObj = await User.findById(user_id).select('role');
        const isSuperAdmin = userObj?.role && (userObj.role.includes('super_admin') || userObj.role === 'super_admin');

        const licenseInfo = await licenseService.getUserLicenseInfo(user_id);
        isOptimizeTier = isSuperAdmin || (licenseInfo?.license_code === 'OPTIMIZE');
        console.log(`[NotificationService] 🔐 Optimize tier check for user ${user_id}: ${isOptimizeTier}`);
      } catch (licenseError) {
        console.error(`[NotificationService] ⚠️ License check failed, defaulting to basic notifications only:`, licenseError.message);
        hasAdvancedNotifications = false;
        isOptimizeTier = false;
      }

      // Filter out advanced channels if user doesn't have license
      const advancedChannels = [ChannelType.EMAIL, ChannelType.PUSH, ChannelType.SMS];
      const licenseFilteredChannels = channels.filter(channelType => {
        if (channelType === ChannelType.WHATSAPP) {
          if (!isOptimizeTier) {
            console.log(`[NotificationService] 🔐 Channel WHATSAPP blocked - user lacks OPTIMIZE license`);
            return false;
          }
          return true;
        }
        if (advancedChannels.includes(channelType) && !hasAdvancedNotifications) {
          console.log(`[NotificationService] 🔐 Channel ${channelType} blocked - user lacks NOTIF_ADV license`);
          return false;
        }
        return true;
      });

      console.log(`[NotificationService] 🔐 License filtered channels:`, licenseFilteredChannels);

      if (licenseFilteredChannels.length === 0) {
        console.log(`[NotificationService] ❌ No channels available after license filtering for user ${user_id}`);
        return null;
      }

      // Filter channels based on user settings and preferences
      console.log(`[NotificationService] Checking channels:`, licenseFilteredChannels);

      const enabledChannels = licenseFilteredChannels.filter(channelType => {
        console.log(`[NotificationService]   Checking channel: ${channelType}`);

        if (!settings.isChannelEnabled(channelType)) {
          console.log(`[NotificationService]     ❌ Channel ${channelType} not enabled in settings`);
          return false;
        }

        // Check if user should receive notification on this channel considering quiet hours
        if (!settings.shouldSendNotification(eventSettingKey, channelType)) {
          console.log(`[NotificationService]     ❌ Notification suppressed (quiet hours or other rules) for ${channelType}`);
          return false;
        }

        // For digest frequencies, queue for later processing
        const frequency = settings.getChannelFrequency(channelType);
        console.log(`[NotificationService]     Channel frequency: ${frequency}`);

        if (frequency === NotificationFrequency.DIGEST_DAILY || frequency === NotificationFrequency.DIGEST_WEEKLY) {
          // Allow email through — sendEmailNotification() will handle digest queuing
          // Only block non-email channels in digest mode (in_app always goes through, others blocked)
          if (channelType === ChannelType.IN_APP || channelType === ChannelType.EMAIL) {
            console.log(`[NotificationService]     ✅ Digest mode, allowing ${channelType} (will queue if email)`);
            return true;
          }
          console.log(`[NotificationService]     ❌ Digest mode, blocking ${channelType}`);
          return false;
        }

        const isNotOff = frequency !== NotificationFrequency.OFF;
        console.log(`[NotificationService]     ${isNotOff ? '✅' : '❌'} Channel ${channelType} ${isNotOff ? 'enabled' : 'OFF'}`);
        return isNotOff;
      });

      console.log(`[NotificationService] Enabled channels:`, enabledChannels);

      if (enabledChannels.length === 0) {
        console.log(`[NotificationService] ❌ No enabled channels for user ${user_id}, creating suppressed record`);
        // G2 FIX: Still create a suppressed notification record for audit/activity purposes
        const suppressedNotification = new Notification({
          user_id,
          trigger_event,
          related_entity,
          priority,
          title,
          message,
          channels: [{ channel_type: ChannelType.IN_APP, status: ChannelStatus.SUPPRESSED, sent_at: null, error_message: 'No enabled channels for user', retry_count: 0 }],
          metadata: { ...metadata, suppressed: true, suppression_reason: 'no_enabled_channels' },
          is_read: true, // Mark as read so it doesn't pollute unread count
          expires_at: expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        await suppressedNotification.save();
        return suppressedNotification;
      }

      // G1 FIX: Auto-digest mode if user receives >10 notifications/hour (overload protection)
      let autoDigestMode = false;
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentNotifCount = await Notification.countDocuments({
          user_id,
          created_at: { $gte: oneHourAgo },
          'metadata.suppressed': { $ne: true }
        });
        if (recentNotifCount >= 10) {
          autoDigestMode = true;
          console.log(`[NotificationService] ⚡ Auto-digest mode activated for user ${user_id} (${recentNotifCount} notifications in last hour)`);
        }
      } catch (countError) {
        console.warn('[NotificationService] ⚠️ Could not check notification overload:', countError.message);
      }

      // Create channel objects
      const channelObjects = enabledChannels.map(channelType => ({
        channel_type: channelType,
        status: ChannelStatus.PENDING,
        sent_at: null,
        error_message: null,
        retry_count: 0
      }));

      // Create notification
      const notification = new Notification({
        user_id,
        trigger_event,
        related_entity,
        priority,
        title,
        message,
        channels: channelObjects,
        metadata: autoDigestMode ? { ...metadata, auto_digest: true } : metadata,
        expires_at
      });

      const savedNotification = await notification.save();

      // Process channels asynchronously (pass auto-digest flag)
      this.processNotificationChannels(savedNotification, autoDigestMode);

      return savedNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Process notification channels (send via different channels)
   * @param {Notification} notification - The notification to process
   */
  static async processNotificationChannels(notification, autoDigestMode = false) {
    try {
      // Track which license features were used for this notification
      let usedBasicNotification = false;
      let usedAdvancedNotification = false;

      for (let i = 0; i < notification.channels.length; i++) {
        const channel = notification.channels[i];

        if (channel.status !== ChannelStatus.PENDING) continue;

        try {
          let success = false;

          switch (channel.channel_type) {
            case ChannelType.IN_APP:
              // In-app notifications are automatically available when created
              success = true;
              if (success) usedBasicNotification = true;
              break;

            case ChannelType.EMAIL:
              // G1 FIX: If auto-digest mode, force queue to digest instead of immediate
              if (autoDigestMode && !this.isUrgentNotification(notification.trigger_event, notification.priority)) {
                try {
                  const user = await User.findById(notification.user_id).select('email firstName lastName');
                  if (user?.email) {
                    await this.queueEmailForDigest([{ user, role: 'auto_digest', priority: 'digest' }], notification, 'daily');
                    console.log(`[Email] ⚡ Auto-digest: queued email for ${user.email} (overload protection)`);
                    success = true;
                  }
                } catch (digestError) {
                  console.warn('[Email] ⚠️ Auto-digest queue failed, falling back to immediate:', digestError.message);
                  success = await this.sendEmailNotification(notification);
                }
              } else {
                success = await this.sendEmailNotification(notification);
              }
              if (success) usedAdvancedNotification = true;
              break;

            case ChannelType.PUSH:
              success = await this.sendPushNotification(notification);
              if (success) usedAdvancedNotification = true;
              break;

            case ChannelType.SMS:
              success = await this.sendSMSNotification(notification);
              if (success) usedAdvancedNotification = true;
              break;

            case ChannelType.WHATSAPP:
              success = await this.sendWhatsAppNotification(notification);
              if (success) usedAdvancedNotification = true;
              break;

            default:
              console.warn(`Unknown channel type: ${channel.channel_type}`);
              continue;
          }

          // Update channel status
          notification.channels[i].status = success ? ChannelStatus.SENT : ChannelStatus.FAILED;
          notification.channels[i].sent_at = success ? new Date() : null;

          if (!success) {
            notification.channels[i].error_message = 'Failed to send notification';
            notification.channels[i].retry_count += 1;
          }

        } catch (channelError) {
          console.error(`Error processing channel ${channel.channel_type}:`, channelError);
          notification.channels[i].status = ChannelStatus.FAILED;
          notification.channels[i].error_message = channelError.message;
          notification.channels[i].retry_count += 1;
        }
      }

      await notification.save();

      // 📊 Track license usage for notifications (after successful processing)
      try {
        const userId = notification.user_id;

        // Track NOTIF_BASIC usage for in-app notifications
        if (usedBasicNotification) {
          const basicResult = await licenseService.consumeFeature(userId, 'NOTIF_BASIC', 1);
          console.log(`[NotificationService] 📊 NOTIF_BASIC usage tracked for user ${userId}:`, basicResult.success ? 'SUCCESS' : basicResult.reason);
        }

        // Track NOTIF_ADV usage for advanced channels (email, push, sms)
        if (usedAdvancedNotification) {
          const advResult = await licenseService.consumeFeature(userId, 'NOTIF_ADV', 1);
          console.log(`[NotificationService] 📊 NOTIF_ADV usage tracked for user ${userId}:`, advResult.success ? 'SUCCESS' : advResult.reason);
        }
      } catch (usageError) {
        // Don't block notification if usage tracking fails
        console.error('[NotificationService] ⚠️ Failed to track notification usage:', usageError.message);
      }
    } catch (error) {
      console.error('Error processing notification channels:', error);
    }
  }

  /**
   * Send email notification with role-based routing
   * @param {Notification} notification - The notification to send
   * @returns {Promise<boolean>} Success status
   */
  static async sendEmailNotification(notification) {
    try {
      // Get primary user (notification recipient)
      const user = await User.findById(notification.user_id)
        .select('email firstName lastName organizationId role');

      if (!user || !user.email) {
        console.log(`[Email] ⚠️ User not found or no email for ${notification.user_id}`);
        return false;
      }

      // ✅ CHECK 1: Is email channel enabled in user's notification settings?
      const settings = await NotificationSettings.getSettingsForUser(notification.user_id);
      if (!settings.channels?.email?.enabled) {
        console.log(`[Email] ⚠️ Email channel disabled for user ${notification.user_id}, skipping email`);
        return false;
      }

      // ✅ CHECK 2: Does user's license plan include email notifications?
      let hasEmailFeature = true;
      if (user.organizationId) {
        try {
          const orgLicenseInfo = await licenseService.getOrganizationLicenseInfo(user.organizationId);
          const licensePlan = orgLicenseInfo?.plan?.name?.toLowerCase() || '';
          const emailSupportedPlans = ['premium', 'pro', 'enterprise', 'business'];
          hasEmailFeature = emailSupportedPlans.some(plan => licensePlan.includes(plan));

          if (!hasEmailFeature) {
            console.log(`[Email] ⚠️ Plan '${licensePlan}' doesn't include email notifications for user ${notification.user_id}`);
            return false;
          }
        } catch (licenseError) {
          console.warn(`[Email] Could not verify license: ${licenseError.message}`);
        }
      }

      // 🎯 Determine email recipients based on event and role
      const recipients = await this.getEmailRecipientsForEvent(
        notification.trigger_event,
        notification.user_id,
        user,
        notification
      );

      if (!recipients || recipients.length === 0) {
        console.log(`[Email] ℹ️ No eligible recipients for event ${notification.trigger_event}`);
        return false;
      }

      // 🏃 Determine if email should be sent immediately or queued for digest
      const isUrgent = this.isUrgentNotification(notification.trigger_event, notification.priority);
      const frequency = settings.getChannelFrequency(ChannelType.EMAIL);

      console.log(`[Email] 📧 Event: ${notification.trigger_event}, Urgent: ${isUrgent}, Frequency: ${frequency}`);

      if (!isUrgent && frequency === NotificationFrequency.DIGEST_DAILY) {
        // Queue for daily digest instead of sending immediately
        await this.queueEmailForDigest(recipients, notification, 'daily');
        console.log(`[Email] 📋 Queued for daily digest (${recipients.length} recipient(s))`);
        return true;
      }

      if (!isUrgent && frequency === NotificationFrequency.DIGEST_WEEKLY) {
        // Queue for weekly digest
        await this.queueEmailForDigest(recipients, notification, 'weekly');
        console.log(`[Email] 📋 Queued for weekly digest (${recipients.length} recipient(s))`);
        return true;
      }

      // 🚀 Send immediate email to all eligible recipients
      const sendResults = await Promise.allSettled(
        recipients.map(recipient => this.sendEmailToRecipient(recipient, notification))
      );

      const successCount = sendResults.filter(r => r.status === 'fulfilled' && r.value).length;
      console.log(`[Email] ✅ Sent to ${successCount}/${recipients.length} recipient(s)`);

      return successCount > 0;
    } catch (error) {
      console.error('[Email] ❌ Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Get eligible email recipients based on event type and user role
   * Implements the Email Notification Matrix
   */
  static async getEmailRecipientsForEvent(triggerEvent, primaryUserId, user, notification) {
    try {
      const recipients = [];

      // Handle user.role as array or string
      let userRole = 'employee';
      if (Array.isArray(user.role)) {
        userRole = (user.role[0] || 'employee').toLowerCase();
      } else if (typeof user.role === 'string') {
        userRole = user.role.toLowerCase();
      }

      console.log(`[Email] 🎯 Routing for event: ${triggerEvent}, user role: ${userRole}`);

      // Email Matrix Implementation
      switch (triggerEvent) {
        case TriggerEvent.TASK_ASSIGNED:
          // Email → Assignee if preference ON, Employee if self-assigned
          if (notification.related_entity?.entity_id) {
            const task = await Task.findById(notification.related_entity.entity_id)
              .select('assigned_to assigned_by');
            if (task?.assigned_to) {
              const assignee = await User.findById(task.assigned_to)
                .select('email firstName lastName');
              if (assignee) {
                recipients.push({
                  user: assignee,
                  role: 'assignee',
                  priority: 'immediate'
                });
              }

              // Also email assignee's manager if manager exists
              // (for manager to be aware of team member assignments)
            }
          }
          break;

        case TriggerEvent.TASK_OVERDUE:
          // Email → Assignee (immediate) + Manager if team is overdue (immediate)
          if (notification.related_entity?.entity_id) {
            const task = await Task.findById(notification.related_entity.entity_id)
              .select('assigned_to team_id');

            // 1️⃣ Always notify assignee about their overdue task
            if (task?.assigned_to) {
              const assignee = await User.findById(task.assigned_to)
                .select('email firstName lastName role');
              if (assignee) {
                recipients.push({
                  user: assignee,
                  role: 'assignee',
                  priority: 'immediate'
                });

                // 2️⃣ Also notify assignee's manager (if exists and is manager role)
                // This helps manager be aware of team member's overdue tasks
                if (assignee.role && Array.isArray(assignee.role)) {
                  if (assignee.role.includes('manager')) {
                    recipients.push({
                      user: assignee,
                      role: 'manager',
                      priority: 'immediate'
                    });
                  }
                }
              }
            }

            // 3️⃣ Notify team manager if this is a team task
            if (task?.team_id && userRole === 'manager') {
              recipients.push({
                user: user,
                role: 'manager',
                priority: 'immediate'
              });
            }
          }
          break;

        case TriggerEvent.APPROVAL_REQUESTED:
          // Email → Approvers (Manager or Org Admin designated in approval)
          // Get approver list from metadata or task approval_to field
          if (notification.metadata?.approver_ids && Array.isArray(notification.metadata.approver_ids)) {
            for (const approverId of notification.metadata.approver_ids) {
              const approver = await User.findById(approverId)
                .select('email firstName lastName role');
              if (approver && approver.role) {
                let approverRole = Array.isArray(approver.role) ? approver.role[0] : approver.role;
                if (approverRole === 'manager' || approverRole === 'org_admin') {
                  recipients.push({
                    user: approver,
                    role: approverRole,
                    priority: 'immediate'
                  });
                }
              }
            }
          }
          // Fallback: if current user is manager or org_admin, they get approval requests
          else if (userRole === 'manager' || userRole === 'org_admin') {
            recipients.push({
              user: user,
              role: userRole,
              priority: 'immediate'
            });
          }
          break;

        case TriggerEvent.APPROVAL_APPROVED:
        case TriggerEvent.APPROVAL_DENIED:
          // Email → Requester (if they have preference enabled)
          if (notification.metadata?.requester_id) {
            const requester = await User.findById(notification.metadata.requester_id)
              .select('email firstName lastName role');
            if (requester) {
              let requesterRole = Array.isArray(requester.role) ? requester.role[0] : requester.role;
              // Send if requester is employee or has email enabled
              if (requesterRole === 'employee' || requesterRole === 'contributor') {
                recipients.push({
                  user: requester,
                  role: 'requester',
                  priority: 'immediate'
                });
              }
            }
          }
          break;

        case TriggerEvent.OVERDUE_ESCALATION:
          // Escalation Path:
          // >48hrs overdue → Manager gets IMMEDIATE email
          // Severe (>7 days or critical) → Org Admin gets IMMEDIATE email

          if (notification.metadata?.severity === 'severe' || notification.metadata?.escalation_level === 'severe') {
            // Severe escalation → Org Admin only
            if (userRole === 'org_admin') {
              recipients.push({
                user: user,
                role: 'org_admin',
                priority: 'immediate'
              });
            }
          } else {
            // Regular >48hrs escalation → Manager
            if (userRole === 'manager') {
              recipients.push({
                user: user,
                role: 'manager',
                priority: 'immediate'
              });
            }
          }

          // Also notify assignee about escalation
          if (notification.related_entity?.entity_id) {
            const task = await Task.findById(notification.related_entity.entity_id)
              .select('assigned_to');
            if (task?.assigned_to) {
              const assignee = await User.findById(task.assigned_to)
                .select('email firstName lastName');
              if (assignee && assignee._id.toString() !== primaryUserId.toString()) {
                recipients.push({
                  user: assignee,
                  role: 'assignee',
                  priority: 'immediate'
                });
              }
            }
          }
          break;

        case TriggerEvent.MILESTONE_MISSED:
          // Email → Manager
          if (userRole === 'manager') {
            recipients.push({
              user: user,
              role: 'manager',
              priority: 'immediate'
            });
          }
          break;

        case TriggerEvent.TASK_CREATED:
        case TriggerEvent.TASK_UPDATED:
        case TriggerEvent.TASK_COMPLETED:
        case TriggerEvent.TASK_COMMENTED:
        case TriggerEvent.USER_MENTIONED:
        case TriggerEvent.TASK_UNSNOOZED:
          // Email → Self (if preference ON), Assignee, Collaborators
          if (userRole === 'employee' || userRole === 'contributor') {
            recipients.push({
              user: user,
              role: userRole,
              priority: 'normal'
            });
          }
          // Add assignee
          if (notification.related_entity?.entity_id) {
            const task = await Task.findById(notification.related_entity.entity_id)
              .select('assigned_to collaborators');
            if (task?.assigned_to) {
              const assignee = await User.findById(task.assigned_to);
              if (assignee && assignee._id.toString() !== primaryUserId.toString()) {
                recipients.push({
                  user: assignee,
                  role: 'assignee',
                  priority: 'normal'
                });
              }
            }
            // Add collaborators (if mentioned)
            if (task?.collaborators && triggerEvent === TriggerEvent.USER_MENTIONED) {
              for (const collabId of task.collaborators) {
                if (collabId.toString() !== primaryUserId.toString()) {
                  const collab = await User.findById(collabId);
                  if (collab) {
                    recipients.push({
                      user: collab,
                      role: 'collaborator',
                      priority: 'normal'
                    });
                  }
                }
              }
            }
          }
          break;

        case TriggerEvent.SYSTEM_MAINTENANCE:
        case TriggerEvent.SECURITY_ALERT:
          // Email → Org Admin only (system/security issues)
          if (userRole === 'org_admin') {
            recipients.push({
              user: user,
              role: 'org_admin',
              priority: 'immediate'
            });
          }
          break;

        // System Failure / Channel Down → Org Admin only
        case 'SYSTEM_FAILURE':
        case 'CHANNEL_DOWN':
          // Critical system alerts only to Org Admin
          if (userRole === 'org_admin') {
            recipients.push({
              user: user,
              role: 'org_admin',
              priority: 'immediate'
            });
          }
          break;

        default:
          // Default: Send only to primary user if they enabled it
          recipients.push({
            user: user,
            role: userRole,
            priority: 'normal'
          });
      }

      console.log(`[Email] 🎯 Eligible recipients: ${recipients.length}`);
      return recipients;
    } catch (error) {
      console.error('[Email] 🎯 Error determining recipients:', error);
      return [];
    }
  }

  /**
   * Check if notification should be sent immediately (urgent)
   */
  static isUrgentNotification(triggerEvent, priority) {
    const urgentEvents = [
      TriggerEvent.TASK_OVERDUE,
      TriggerEvent.OVERDUE_ESCALATION,
      TriggerEvent.APPROVAL_REQUESTED,
      TriggerEvent.APPROVAL_APPROVED,
      TriggerEvent.APPROVAL_DENIED,
      TriggerEvent.SYSTEM_MAINTENANCE,
      TriggerEvent.SECURITY_ALERT
    ];

    return urgentEvents.includes(triggerEvent) || priority === NotificationPriority.URGENT;
  }

  /**
   * Send email to a single recipient
   */
  static async sendEmailToRecipient(recipient, notification) {
    try {
      const { user, role, priority } = recipient;

      if (!user?.email) {
        console.log(`[Email] ⚠️ No email for ${role}`);
        return false;
      }

      // Double-check email preference
      const recipientSettings = await NotificationSettings.getSettingsForUser(user._id);
      if (!recipientSettings.channels?.email?.enabled) {
        console.log(`[Email] ⚠️ Email disabled for ${role}: ${user.email}`);
        return false;
      }

      const emailData = {
        to: user.email,
        subject: `[${priority.toUpperCase()}] ${notification.title}`,
        text: notification.message,
        html: this.generateEmailHTML(notification, user, role)
      };

      await emailService.sendEmail(emailData);
      console.log(`[Email] ✅ Sent to ${role}: ${user.email}`);
      return true;
    } catch (error) {
      console.error(`[Email] ❌ Error sending to recipient:`, error);
      return false;
    }
  }

  /**
   * Queue email for daily or weekly digest
   */
  static async queueEmailForDigest(recipients, notification, frequency) {
    try {
      const { EmailDigestQueue } = await import('../modals/emailDigestQueueModal.js');

      let queuedCount = 0;
      for (const recipient of recipients) {
        try {
          await EmailDigestQueue.create({
            user_id: recipient.user._id,
            notification_id: notification._id,
            frequency,
            title: notification.title,
            message: notification.message,
            trigger_event: notification.trigger_event,
            priority: notification.priority,
            recipient_email: recipient.user.email,
            recipient_name: `${recipient.user.firstName || ''} ${recipient.user.lastName || ''}`.trim(),
            recipient_role: recipient.role || 'user',
            queued_at: new Date()
          });
          queuedCount++;
        } catch (queueError) {
          console.error(`[Email] 📋 Error queueing digest for ${recipient.user.email}:`, queueError.message);
        }
      }

      console.log(`[Email] 📋 Digest queue - Frequency: ${frequency}, Queued: ${queuedCount}/${recipients.length}`);
      return queuedCount > 0;
    } catch (error) {
      console.error('[Email] 📋 Error queueing digest:', error);
      return false;
    }
  }

  /**
   * Send push notification
   * @param {Notification} notification - The notification to send
   * @returns {Promise<boolean>} Success status
   */
  static async sendPushNotification(notification) {
    try {
      // TODO: Implement push notification logic
      // This would typically use a service like Firebase Cloud Messaging (FCM)
      // or Apple Push Notification Service (APNs)
      console.log('Push notification would be sent:', {
        user_id: notification.user_id,
        title: notification.title,
        message: notification.message
      });

      // For now, return true as placeholder
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Send SMS notification
   * @param {Notification} notification - The notification to send
   * @returns {Promise<boolean>} Success status
   */
  static async sendSMSNotification(notification) {
    try {
      // TODO: Implement SMS notification logic
      // This would typically use a service like Twilio, AWS SNS, or similar
      console.log('SMS notification would be sent:', {
        user_id: notification.user_id,
        title: notification.title,
        message: notification.message
      });

      // For now, return true as placeholder
      return true;
    } catch (error) {
      console.error('Error sending SMS notification:', error);
      return false;
    }
  }

  /**
   * Send WhatsApp notification
   * @param {Notification} notification - The notification to send
   * @returns {Promise<boolean>} Success status
   */
  static async sendWhatsAppNotification(notification) {
    try {
      const user = await User.findById(notification.user_id).select('phone firstName');
      if (!user || !user.phone) {
        console.warn(`[NotificationService] No phone number for user ${notification.user_id}, cannot send WhatsApp notification`);
        return false;
      }

      // Check user preferences specifically for whatsapp
      const settings = await NotificationSettings.getSettingsForUser(notification.user_id);
      if (!settings.channels?.whatsapp?.enabled) {
        console.log(`[NotificationService] WhatsApp notification disabled for user ${notification.user_id}`);
        return false;
      }

      const templateName = notification.metadata?.whatsapp_template || "hello_world";
      const languageCode = notification.metadata?.whatsapp_language || "en_US";
      const components = notification.metadata?.whatsapp_components || [];

      await whatsappService.sendWhatsApp(
        user.phone,
        templateName,
        languageCode,
        components
      );

      return true;
    } catch (error) {
      console.error('[NotificationService] Error sending WhatsApp notification:', error);
      return false;
    }
  }

  /**
   * Generate HTML email content for notification
   * @param {Notification} notification - The notification
   * @param {Object} user - User object
   * @param {string} role - User role for this notification
   * @returns {string} HTML content
   */
  static generateEmailHTML(notification, user, role = 'user') {
    const priorityColor = notification.priority === NotificationPriority.URGENT ? '#dc3545' : '#007bff';
    const roleLabel = role ? ` (${role.charAt(0).toUpperCase() + role.slice(1)})` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6; 
            color: #333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 0;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white; 
            padding: 30px 20px;
            text-align: center;
            border-bottom: 4px solid ${priorityColor};
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .priority-badge {
            display: inline-block;
            background: ${priorityColor};
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
            text-transform: uppercase;
          }
          .content { 
            padding: 30px 20px;
            background: #f9f9f9;
          }
          .content h2 {
            color: #007bff;
            margin-top: 0;
            border-left: 4px solid ${priorityColor};
            padding-left: 15px;
          }
          .greeting {
            color: #555;
            margin-bottom: 20px;
          }
          .message-body {
            background: white;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid ${priorityColor};
          }
          .metadata {
            margin-top: 20px; 
            padding: 15px; 
            background: white; 
            border-radius: 5px;
            border: 1px solid #ddd;
          }
          .metadata h4 {
            margin-top: 0;
            color: #007bff;
          }
          .metadata-item {
            margin: 10px 0;
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 15px;
          }
          .metadata-label {
            font-weight: 600;
            color: #555;
          }
          .cta-button {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            margin-top: 20px;
            text-align: center;
            transition: background 0.3s;
          }
          .cta-button:hover {
            background: #0056b3;
          }
          .footer { 
            text-align: center; 
            padding: 20px; 
            font-size: 12px; 
            color: #999;
            background: #f5f5f5;
            border-top: 1px solid #ddd;
          }
          .footer a {
            color: #007bff;
            text-decoration: none;
          }
          .role-info {
            background: #e7f3ff;
            padding: 10px 15px;
            border-radius: 4px;
            font-size: 13px;
            color: #0056b3;
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📬 TaskSetu Notification</h1>
            <div class="priority-badge">${notification.priority === NotificationPriority.URGENT ? '🔴 URGENT' : '⚠️ ' + notification.priority.toUpperCase()}</div>
          </div>
          
          <div class="content">
            <div class="greeting">
              Hi ${user.firstName || 'User'},${roleLabel}
            </div>

            ${role ? `
            <div class="role-info">
              📋 You're receiving this as: <strong>${role.replace('_', ' ').toUpperCase()}</strong>
            </div>
            ` : ''}
            
            <h2>${notification.title}</h2>
            
            <div class="message-body">
              ${notification.message.replace(/\n/g, '<br>')}
            </div>
            
            ${notification.metadata && Object.keys(notification.metadata).length > 0 ? `
            <div class="metadata">
              <h4>📌 Additional Details</h4>
              ${Object.entries(notification.metadata).map(([key, value]) => `
                <div class="metadata-item">
                  <span class="metadata-label">${key.replace(/_/g, ' ')}:</span>
                  <span>${value}</span>
                </div>
              `).join('')}
            </div>
            ` : ''}
            
            <div style="text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" class="cta-button">
                👉 View in TaskSetu
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from <strong>TaskSetu</strong>.</p>
            <p>You're receiving this because you're involved in this task/project or have this notification enabled.</p>
            <p>
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/settings/notifications">Manage your notification preferences</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get notifications for a user with pagination and filtering
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Notifications and metadata
   */
  static async getUserNotifications(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        priority = null,
        isRead = null,
        triggerEvent = null,
        includeExpired = false
      } = options;

      const notifications = await Notification.getByUser(userId, {
        page,
        limit,
        priority,
        isRead,
        triggerEvent
      });

      const totalCount = await Notification.countDocuments({
        user_id: userId,
        deleted_at: null,
        'channels.channel_type': 'in_app',
        ...(includeExpired ? {} : {
          $or: [
            { expires_at: null },
            { expires_at: { $gt: new Date() } }
          ]
        }),
        ...(priority && { priority }),
        ...(isRead !== null && { is_read: isRead }),
        ...(triggerEvent && { trigger_event: triggerEvent })
      });

      const unreadCount = await Notification.getUnreadCount(userId);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        unreadCount
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {ObjectId} notificationId - Notification ID
   * @param {ObjectId} userId - User ID (for security)
   * @returns {Promise<Notification>} Updated notification
   */
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        user_id: userId,
        deleted_at: null
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      return await notification.markAsRead();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {ObjectId} userId - User ID
   * @returns {Promise<Object>} Update result
   */
  static async markAllAsRead(userId) {
    try {
      return await Notification.markMultipleAsRead(userId);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete notification (soft delete)
   * @param {ObjectId} notificationId - Notification ID
   * @param {ObjectId} userId - User ID (for security)
   * @returns {Promise<Notification>} Updated notification
   */
  static async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        user_id: userId,
        deleted_at: null
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      return await notification.softDelete();
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for a user
   * @param {ObjectId} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  static async getUserNotificationStats(userId) {
    try {
      return await Notification.getStats(userId);
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired notifications (can be run as a cron job)
   * @returns {Promise<Object>} Cleanup result
   */
  static async cleanupExpiredNotifications() {
    try {
      return await Notification.cleanupExpired();
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
      throw error;
    }
  }

  /**
   * Retry failed notification channels
   * @param {ObjectId} notificationId - Notification ID
   * @param {number} maxRetries - Maximum retry count (default: 3)
   * @returns {Promise<Notification>} Updated notification
   */
  static async retryFailedChannels(notificationId, maxRetries = 3) {
    try {
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        throw new Error('Notification not found');
      }

      // Find failed channels that haven't exceeded max retries
      const failedChannels = notification.channels.filter(
        channel => channel.status === ChannelStatus.FAILED && channel.retry_count < maxRetries
      );

      if (failedChannels.length === 0) {
        return notification;
      }

      // Reset failed channels to pending for retry
      notification.channels.forEach(channel => {
        if (channel.status === ChannelStatus.FAILED && channel.retry_count < maxRetries) {
          channel.status = ChannelStatus.PENDING;
          channel.error_message = null;
        }
      });

      await notification.save();

      // Process the channels again
      await this.processNotificationChannels(notification);

      return await Notification.findById(notificationId);
    } catch (error) {
      console.error('Error retrying failed channels:', error);
      throw error;
    }
  }

  /**
   * Map trigger events to notification settings keys
   * @param {string} triggerEvent - The trigger event
   * @returns {string|null} Settings key or null if not mapped
   */
  static getEventSettingKey(triggerEvent) {
    // Maps trigger events to UI event_preferences keys
    // Only includes trigger events that EXIST in the TriggerEvent enum
    // Each maps to the matching UI checkbox key in NotificationSettings
    const eventMap = {
      // "Task Assigned" checkbox (key: task_assigned)
      [TriggerEvent.TASK_CREATED]: 'task_assigned',       // task creation → task_assigned
      [TriggerEvent.TASK_REASSIGNED]: 'task_reassigned',  // reassignment → task_reassigned toggle

      // "Due Date Reminders" checkbox (key: task_due_soon)
      [TriggerEvent.TASK_DUE_SOON]: 'task_due_soon',     // due soon → task_due_soon
      [TriggerEvent.TASK_DUE_TODAY]: 'task_due_soon',    // due today also controlled by same toggle

      // "Overdue Alerts" checkbox (key: task_overdue)
      [TriggerEvent.TASK_OVERDUE]: 'task_overdue',

      // "Status Changes" checkbox (key: task_status_changed)
      [TriggerEvent.TASK_UPDATED]: 'task_status_changed',   // task updates → status changes toggle
      [TriggerEvent.TASK_COMPLETED]: 'task_status_changed', // completion is a status change

      // "Task Reminder" checkbox (key: task_reminder)
      [TriggerEvent.TASK_REMINDER]: 'task_reminder',

      // Snooze events (no dedicated UI toggle, default enabled)
      [TriggerEvent.TASK_SNOOZED]: 'task_snoozed',
      [TriggerEvent.TASK_UNSNOOZED]: 'task_unsnoozed',

      // Quick task events (no dedicated UI toggle, default enabled)
      [TriggerEvent.QUICK_TASK_COMPLETED]: 'quick_task_completed',
      [TriggerEvent.QUICK_TASK_CONVERTED]: 'quick_task_converted',

      // "Approval Requests/Granted/Denied" checkboxes
      [TriggerEvent.APPROVAL_REQUESTED]: 'approval_requested',
      [TriggerEvent.APPROVAL_APPROVED]: 'approval_approved',
      [TriggerEvent.APPROVAL_DENIED]: 'approval_denied',

      // "New Comments" checkbox (key: comment_added)
      [TriggerEvent.COMMENT_ADDED]: 'comment_added',

      // "Mentions" checkbox (key: user_mentioned)
      [TriggerEvent.USER_MENTIONED]: 'user_mentioned',

      // Subtask events (no dedicated UI toggle, default enabled)
      [TriggerEvent.SUBTASK_ADDED]: 'subtask_added',
      [TriggerEvent.SUBTASK_COMPLETED]: 'subtask_completed',

      // File events (no dedicated UI toggle, default enabled)
      [TriggerEvent.FILE_UPLOADED]: 'file_uploaded',
      [TriggerEvent.FILE_EDITED]: 'file_edited',

      // Milestone events (no dedicated UI toggle, default enabled)
      [TriggerEvent.MILESTONE_ACHIEVED]: 'milestone_achieved',
      [TriggerEvent.MILESTONE_MISSED]: 'milestone_missed',

      // Escalation events (no dedicated UI toggle, default enabled)
      [TriggerEvent.OVERDUE_ESCALATION]: 'overdue_escalation',
      [TriggerEvent.CRITICAL_ESCALATION]: 'overdue_escalation',

      // Recurring task events (no dedicated UI toggle, default enabled)
      [TriggerEvent.RECURRING_INSTANCE_CREATED]: 'recurring_instance_created',

      // Form events (no dedicated UI toggle, default enabled)
      [TriggerEvent.FORM_PUBLISHED]: 'form_published',
      [TriggerEvent.FORM_SUBMITTED]: 'form_submitted',

      // System events (no dedicated UI toggle, always enabled)
      [TriggerEvent.SYSTEM_TEST]: null,
    };

    return eventMap[triggerEvent] || null;
  }
}

