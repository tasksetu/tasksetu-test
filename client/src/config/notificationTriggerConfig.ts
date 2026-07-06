import { 
  TriggerEvent, 
  NotificationPriority, 
  ChannelType 
} from '../models';

/**
 * Configuration interface for notification triggers
 */
export interface TriggerConfig {
  trigger_event: TriggerEvent;
  default_recipient_roles: string[];
  priority: NotificationPriority;
  default_channels: ChannelType[];
  title_template: string;
  message_template: string;
  suppression_window_minutes: number;
  should_escalate: boolean;
  escalation_hours?: number;
}

/**
 * Centralized notification trigger configuration system
 * Manages all notification behavior and templates
 */
export class NotificationTriggerConfig {
  private static readonly configMap = new Map<TriggerEvent, TriggerConfig>();

  // Initialize all trigger configurations
  static {
    this.initializeConfigurations();
  }

  /**
   * Initialize all notification trigger configurations
   */
  private static initializeConfigurations(): void {
    const configs: TriggerConfig[] = [
      // Task Management Events
      {
        trigger_event: TriggerEvent.TASK_CREATED,
        default_recipient_roles: ['assignee'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'New Task Assigned: {{task_title}}',
        message_template: '{{creator_name}} assigned you a new task',
        suppression_window_minutes: 1,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.TASK_UPDATED,
        default_recipient_roles: ['creator', 'assignee'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP],
        title_template: 'Task Updated: {{task_title}}',
        message_template: '{{updater_name}} updated the task',
        suppression_window_minutes: 5,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.TASK_OVERDUE,
        default_recipient_roles: ['assignee'],
        priority: NotificationPriority.URGENT,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.PUSH],
        title_template: 'Task Overdue: {{task_title}}',
        message_template: 'This task is now overdue',
        suppression_window_minutes: 1440, // 24 hours
        should_escalate: true,
        escalation_hours: 48
      },
      {
        trigger_event: TriggerEvent.TASK_COMPLETED,
        default_recipient_roles: ['creator', 'manager'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'Task Completed: {{task_title}}',
        message_template: '{{completer_name}} completed the task',
        suppression_window_minutes: 1,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.TASK_REASSIGNED,
        default_recipient_roles: ['assignee'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'You have been assigned a task: {{task_title}}',
        message_template: '{{reassigner_name}} reassigned this task to you',
        suppression_window_minutes: 1,
        should_escalate: false
      },

      // Approval Events
      {
        trigger_event: TriggerEvent.APPROVAL_REQUESTED,
        default_recipient_roles: ['approver'],
        priority: NotificationPriority.URGENT,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.PUSH],
        title_template: 'Approval Required: {{task_title}}',
        message_template: '{{requester_name}} requests your approval',
        suppression_window_minutes: 1,
        should_escalate: true,
        escalation_hours: 24
      },
      {
        trigger_event: TriggerEvent.APPROVAL_APPROVED,
        default_recipient_roles: ['creator'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'Approval Granted: {{task_title}}',
        message_template: '{{approver_name}} approved your request',
        suppression_window_minutes: 1,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.APPROVAL_DENIED,
        default_recipient_roles: ['creator'],
        priority: NotificationPriority.URGENT,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'Approval Denied: {{task_title}}',
        message_template: '{{approver_name}} denied your request. Reason: {{denial_reason}}',
        suppression_window_minutes: 1,
        should_escalate: false
      },

      // Communication Events
      {
        trigger_event: TriggerEvent.USER_MENTIONED,
        default_recipient_roles: ['mentioned_user'],
        priority: NotificationPriority.URGENT,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: '{{mentioner_name}} mentioned you in {{task_title}}',
        message_template: '{{comment_excerpt}}',
        suppression_window_minutes: 1,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.COMMENT_ADDED,
        default_recipient_roles: ['collaborator'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP],
        title_template: 'New Comment on {{task_title}}',
        message_template: '{{commenter_name}} added a comment',
        suppression_window_minutes: 2,
        should_escalate: false
      },

      // Task Reminders and Due Dates
      {
        trigger_event: TriggerEvent.TASK_REMINDER,
        default_recipient_roles: ['assignee'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP, ChannelType.PUSH],
        title_template: 'Reminder: {{task_title}}',
        message_template: 'This is a reminder for your task',
        suppression_window_minutes: 1,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.TASK_DUE_TODAY,
        default_recipient_roles: ['assignee'],
        priority: NotificationPriority.URGENT,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'Task Due Today: {{task_title}}',
        message_template: 'Don\'t forget to complete this task by end of day',
        suppression_window_minutes: 1,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.TASK_DUE_SOON,
        default_recipient_roles: ['assignee'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'Task Due Soon: {{task_title}}',
        message_template: 'Your task is due in {{hours_remaining}} hours',
        suppression_window_minutes: 30,
        should_escalate: false
      },

      // Escalation Events
      {
        trigger_event: TriggerEvent.OVERDUE_ESCALATION,
        default_recipient_roles: ['manager'],
        priority: NotificationPriority.URGENT,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.PUSH],
        title_template: 'Overdue Task Requires Attention',
        message_template: '{{assignee_name}}\'s task {{task_title}} is overdue by {{hours_overdue}} hours',
        suppression_window_minutes: 1440, // 24 hours
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.CRITICAL_ESCALATION,
        default_recipient_roles: ['admin'],
        priority: NotificationPriority.URGENT,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.PUSH, ChannelType.SMS],
        title_template: 'Critical: Task Escalation',
        message_template: 'Task {{task_title}} requires immediate admin attention',
        suppression_window_minutes: 1,
        should_escalate: false
      },

      // Milestone Events
      {
        trigger_event: TriggerEvent.MILESTONE_ACHIEVED,
        default_recipient_roles: ['creator', 'manager'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP],
        title_template: 'Milestone Achieved: {{milestone_name}}',
        message_template: '{{achiever_name}} achieved a milestone in {{task_title}}',
        suppression_window_minutes: 1,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.MILESTONE_MISSED,
        default_recipient_roles: ['assignee', 'manager'],
        priority: NotificationPriority.URGENT,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'Milestone Missed: {{milestone_name}}',
        message_template: 'Milestone deadline passed for {{task_title}}',
        suppression_window_minutes: 1,
        should_escalate: true,
        escalation_hours: 12
      },

      // Subtask Events
      {
        trigger_event: TriggerEvent.SUBTASK_ADDED,
        default_recipient_roles: ['assignee', 'creator'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP],
        title_template: 'Subtask Added to {{task_title}}',
        message_template: '{{creator_name}} added a new subtask: {{subtask_title}}',
        suppression_window_minutes: 5,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.SUBTASK_COMPLETED,
        default_recipient_roles: ['creator', 'manager'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP],
        title_template: 'Subtask Completed in {{task_title}}',
        message_template: '{{completer_name}} completed subtask: {{subtask_title}}',
        suppression_window_minutes: 2,
        should_escalate: false
      },

      // Recurring Task Events
      {
        trigger_event: TriggerEvent.RECURRING_INSTANCE_CREATED,
        default_recipient_roles: ['assignee'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'New Instance: {{task_title}}',
        message_template: 'A new instance of your recurring task has been created',
        suppression_window_minutes: 60,
        should_escalate: false
      },

      // Quick Task Events
      {
        trigger_event: TriggerEvent.QUICK_TASK_COMPLETED,
        default_recipient_roles: ['creator'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP],
        title_template: 'Quick Task Completed: {{task_title}}',
        message_template: '{{completer_name}} completed the quick task',
        suppression_window_minutes: 1,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.QUICK_TASK_CONVERTED,
        default_recipient_roles: ['creator', 'assignee'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP, ChannelType.EMAIL],
        title_template: 'Quick Task Converted: {{task_title}}',
        message_template: 'Quick task has been converted to a regular task',
        suppression_window_minutes: 1,
        should_escalate: false
      },

      // File Events
      {
        trigger_event: TriggerEvent.FILE_UPLOADED,
        default_recipient_roles: ['collaborator'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP],
        title_template: 'File Uploaded to {{task_title}}',
        message_template: '{{uploader_name}} uploaded {{file_name}}',
        suppression_window_minutes: 2,
        should_escalate: false
      },
      {
        trigger_event: TriggerEvent.FILE_EDITED,
        default_recipient_roles: ['collaborator'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP],
        title_template: 'File Updated in {{task_title}}',
        message_template: '{{editor_name}} updated {{file_name}}',
        suppression_window_minutes: 5,
        should_escalate: false
      },

      // System Test Event
      {
        trigger_event: TriggerEvent.SYSTEM_TEST,
        default_recipient_roles: ['admin'],
        priority: NotificationPriority.NORMAL,
        default_channels: [ChannelType.IN_APP],
        title_template: 'Test Notification',
        message_template: 'This is a test notification to verify the system is working',
        suppression_window_minutes: 1,
        should_escalate: false
      }
    ];

    // Populate the configuration map
    configs.forEach(config => {
      this.configMap.set(config.trigger_event, config);
    });
  }

  /**
   * Get configuration for a specific trigger event
   * @param triggerEvent - The trigger event
   * @returns TriggerConfig
   * @throws Error if configuration not found
   */
  static getConfig(triggerEvent: TriggerEvent): TriggerConfig {
    const config = this.configMap.get(triggerEvent);
    if (!config) {
      throw new Error(`No configuration found for trigger event: ${triggerEvent}`);
    }
    return config;
  }

  /**
   * Get recipient roles for a trigger event
   * @param triggerEvent - The trigger event
   * @returns Array of recipient role strings
   */
  static getRecipientRoles(triggerEvent: TriggerEvent): string[] {
    const config = this.getConfig(triggerEvent);
    return [...config.default_recipient_roles];
  }

  /**
   * Format notification title with data placeholders
   * @param triggerEvent - The trigger event
   * @param data - Data object with placeholder values
   * @returns Formatted title string
   */
  static formatTitle(triggerEvent: TriggerEvent, data: Record<string, any>): string {
    const config = this.getConfig(triggerEvent);
    return this.replacePlaceholders(config.title_template, data);
  }

  /**
   * Format notification message with data placeholders
   * @param triggerEvent - The trigger event
   * @param data - Data object with placeholder values
   * @returns Formatted message string
   */
  static formatMessage(triggerEvent: TriggerEvent, data: Record<string, any>): string {
    const config = this.getConfig(triggerEvent);
    return this.replacePlaceholders(config.message_template, data);
  }

  /**
   * Get all configured trigger events
   * @returns Array of all TriggerEvent values
   */
  static getAllTriggerEvents(): TriggerEvent[] {
    return Array.from(this.configMap.keys());
  }

  /**
   * Get default notification preferences based on user role
   * @param role - User role string
   * @returns Array of default preferences
   */
  static getDefaultPreferencesByRole(role: string): Array<{
    trigger_event: TriggerEvent;
    channels: Record<string, boolean>;
    priority: NotificationPriority;
  }> {
    const preferences: Array<{
      trigger_event: TriggerEvent;
      channels: Record<string, boolean>;
      priority: NotificationPriority;
    }> = [];

    // Define role-based channel preferences
    const roleChannelPreferences: Record<string, Record<string, boolean>> = {
      'admin': {
        [ChannelType.IN_APP]: true,
        [ChannelType.EMAIL]: true,
        [ChannelType.PUSH]: true,
        [ChannelType.SMS]: false
      },
      'manager': {
        [ChannelType.IN_APP]: true,
        [ChannelType.EMAIL]: true,
        [ChannelType.PUSH]: true,
        [ChannelType.SMS]: false
      },
      'assignee': {
        [ChannelType.IN_APP]: true,
        [ChannelType.EMAIL]: true,
        [ChannelType.PUSH]: false,
        [ChannelType.SMS]: false
      },
      'creator': {
        [ChannelType.IN_APP]: true,
        [ChannelType.EMAIL]: true,
        [ChannelType.PUSH]: false,
        [ChannelType.SMS]: false
      },
      'collaborator': {
        [ChannelType.IN_APP]: true,
        [ChannelType.EMAIL]: false,
        [ChannelType.PUSH]: false,
        [ChannelType.SMS]: false
      },
      'approver': {
        [ChannelType.IN_APP]: true,
        [ChannelType.EMAIL]: true,
        [ChannelType.PUSH]: true,
        [ChannelType.SMS]: false
      }
    };

    const defaultChannels = roleChannelPreferences[role] || roleChannelPreferences['assignee'];

    // Create preferences for all trigger events
    this.getAllTriggerEvents().forEach(triggerEvent => {
      const config = this.getConfig(triggerEvent);
      
      // Only include events where this role is a default recipient
      if (config.default_recipient_roles.includes(role)) {
        preferences.push({
          trigger_event: triggerEvent,
          channels: { ...defaultChannels },
          priority: config.priority
        });
      }
    });

    return preferences;
  }

  /**
   * Replace placeholders in template strings
   * @private
   * @param template - Template string with {{placeholder}} syntax
   * @param data - Data object with placeholder values
   * @returns String with placeholders replaced
   */
  private static replacePlaceholders(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get escalation configuration for a trigger event
   * @param triggerEvent - The trigger event
   * @returns Escalation configuration or null
   */
  static getEscalationConfig(triggerEvent: TriggerEvent): {
    should_escalate: boolean;
    escalation_hours?: number;
  } {
    const config = this.getConfig(triggerEvent);
    return {
      should_escalate: config.should_escalate,
      escalation_hours: config.escalation_hours
    };
  }

  /**
   * Get suppression window for a trigger event
   * @param triggerEvent - The trigger event
   * @returns Suppression window in minutes
   */
  static getSuppressionWindow(triggerEvent: TriggerEvent): number {
    const config = this.getConfig(triggerEvent);
    return config.suppression_window_minutes;
  }

  /**
   * Check if trigger event has urgent priority
   * @param triggerEvent - The trigger event
   * @returns True if urgent priority
   */
  static isUrgent(triggerEvent: TriggerEvent): boolean {
    const config = this.getConfig(triggerEvent);
    return config.priority === NotificationPriority.URGENT;
  }

  /**
   * Get default channels for a trigger event
   * @param triggerEvent - The trigger event
   * @returns Array of default channel types
   */
  static getDefaultChannels(triggerEvent: TriggerEvent): ChannelType[] {
    const config = this.getConfig(triggerEvent);
    return [...config.default_channels];
  }

  /**
   * Get all configurations as a read-only map
   * @returns ReadonlyMap of all configurations
   */
  static getAllConfigurations(): ReadonlyMap<TriggerEvent, TriggerConfig> {
    return new Map(this.configMap);
  }
}