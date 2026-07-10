import mongoose from 'mongoose';

/**
 * Notification Settings Schema
 * Manages user preferences for different types of notifications and delivery channels
 */

// Notification frequency options
const NotificationFrequency = {
  REAL_TIME: 'real_time',
  DIGEST_DAILY: 'digest_daily',
  DIGEST_WEEKLY: 'digest_weekly',
  OFF: 'off'
};

// Channel specific settings schema
const channelSettingsSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true,
    description: 'Whether this channel is enabled for the user'
  },
  frequency: {
    type: String,
    enum: Object.values(NotificationFrequency),
    default: NotificationFrequency.REAL_TIME,
    description: 'How frequently to send notifications via this channel'
  },
  quiet_hours: {
    start: {
      type: String,
      default: '22:00',
      description: 'Start of quiet hours (HH:MM format)'
    },
    end: {
      type: String,
      default: '08:00',
      description: 'End of quiet hours (HH:MM format)'
    },
    enabled: {
      type: Boolean,
      default: false,
      description: 'Whether quiet hours are enabled'
    }
  }
}, { _id: false });

// Event-specific notification preferences
const eventPreferencesSchema = new mongoose.Schema({
  // Task-related events
  task_assigned: {
    type: Boolean,
    default: true,
    description: 'Notify when a task is assigned to the user'
  },
  task_due_soon: {
    type: Boolean,
    default: true,
    description: 'Notify when a task is due soon'
  },
  task_due_today: {
    type: Boolean,
    default: true,
    description: 'Notify when a task is due today'
  },
  task_overdue: {
    type: Boolean,
    default: true,
    description: 'Notify when a task becomes overdue'
  },
  task_completed: {
    type: Boolean,
    default: true,
    description: 'Notify when a task assigned by user is completed'
  },
  task_status_changed: {
    type: Boolean,
    default: true,
    description: 'Notify when task status changes'
  },
  task_reassigned: {
    type: Boolean,
    default: true,
    description: 'Notify when a task is reassigned'
  },
  task_updated: {
    type: Boolean,
    default: true,
    description: 'Notify when task details are updated'
  },
  task_commented: {
    type: Boolean,
    default: true,
    description: 'Notify when someone comments on user\'s task'
  },
  task_reminder: {
    type: Boolean,
    default: true,
    description: 'Send daily task reminders'
  },
  task_snoozed: {
    type: Boolean,
    default: true,
    description: 'Notify when a task is snoozed'
  },
  task_unsnoozed: {
    type: Boolean,
    default: true,
    description: 'Notify when a task wakes up from snooze'
  },

  // Quick task events
  quick_task_completed: {
    type: Boolean,
    default: true,
    description: 'Notify when a quick task is completed'
  },
  quick_task_converted: {
    type: Boolean,
    default: true,
    description: 'Notify when a quick task is converted to full task'
  },

  // Approval workflow events
  approval_requested: {
    type: Boolean,
    default: true,
    description: 'Notify when approval is requested'
  },
  approval_approved: {
    type: Boolean,
    default: true,
    description: 'Notify when approval is granted'
  },
  approval_denied: {
    type: Boolean,
    default: true,
    description: 'Notify when approval is denied'
  },

  // Comment and mention events
  comment_added: {
    type: Boolean,
    default: true,
    description: 'Notify when a comment is added'
  },
  user_mentioned: {
    type: Boolean,
    default: true,
    description: 'Notify when user is mentioned in a comment'
  },

  // Subtask events
  subtask_added: {
    type: Boolean,
    default: true,
    description: 'Notify when a subtask is added'
  },
  subtask_completed: {
    type: Boolean,
    default: true,
    description: 'Notify when a subtask is completed'
  },

  // File attachment events
  file_uploaded: {
    type: Boolean,
    default: true,
    description: 'Notify when a file is uploaded to a task'
  },
  file_edited: {
    type: Boolean,
    default: true,
    description: 'Notify when a file is edited'
  },

  // Milestone events
  milestone_achieved: {
    type: Boolean,
    default: true,
    description: 'Notify when a milestone is achieved'
  },
  milestone_missed: {
    type: Boolean,
    default: true,
    description: 'Notify when a milestone is missed'
  },

  // Escalation events
  overdue_escalation: {
    type: Boolean,
    default: true,
    description: 'Notify when a task is severely overdue'
  },

  // Recurring task events
  recurring_instance_created: {
    type: Boolean,
    default: true,
    description: 'Notify when a new recurring task instance is created'
  },

  // Project-related events
  project_assigned: {
    type: Boolean,
    default: true,
    description: 'Notify when assigned to a project'
  },
  project_updated: {
    type: Boolean,
    default: true,
    description: 'Notify when project details are updated'
  },
  project_completed: {
    type: Boolean,
    default: true,
    description: 'Notify when a project is completed'
  },
  project_milestone_reached: {
    type: Boolean,
    default: true,
    description: 'Notify when project milestone is reached'
  },

  // Team-related events
  team_member_added: {
    type: Boolean,
    default: true,
    description: 'Notify when added to a team'
  },
  team_member_removed: {
    type: Boolean,
    default: true,
    description: 'Notify when removed from a team'
  },
  team_updated: {
    type: Boolean,
    default: true,
    description: 'Notify when team details are updated'
  },

  // System events
  system_maintenance: {
    type: Boolean,
    default: true,
    description: 'Notify about system maintenance'
  },
  security_alert: {
    type: Boolean,
    default: true,
    description: 'Notify about security-related events'
  },
  feature_announcement: {
    type: Boolean,
    default: true,
    description: 'Notify about new features'
  },

  // Super Admin specific events
  new_organization_registration: {
    type: Boolean,
    default: true,
    description: 'Notify super admin when new organization registers'
  },
  new_user_registration: {
    type: Boolean,
    default: true,
    description: 'Notify super admin when new individual user registers'
  },
  package_plan_purchase: {
    type: Boolean,
    default: true,
    description: 'Notify super admin when package/plan is purchased'
  }
}, { _id: false });

// Main notification settings schema
const notificationSettingsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    description: 'Reference to the user'
  },

  // Global notification toggle
  notifications_enabled: {
    type: Boolean,
    default: true,
    description: 'Master switch for all notifications'
  },

  // Channel-specific settings
  channels: {
    in_app: channelSettingsSchema,
    email: channelSettingsSchema,
    push: channelSettingsSchema,
    sms: channelSettingsSchema,
    whatsapp: channelSettingsSchema
  },

  // Event-specific preferences
  event_preferences: eventPreferencesSchema,

  // Digest settings
  digest_settings: {
    daily_digest_time: {
      type: String,
      default: '09:00',
      description: 'Time to send daily digest (HH:MM format)'
    },
    weekly_digest_day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      default: 'monday',
      description: 'Day of week to send weekly digest'
    },
    weekly_digest_time: {
      type: String,
      default: '09:00',
      description: 'Time to send weekly digest (HH:MM format)'
    },
    include_completed_tasks: {
      type: Boolean,
      default: false,
      description: 'Include completed tasks in digest'
    },
    max_digest_items: {
      type: Number,
      default: 10,
      min: 1,
      max: 50,
      description: 'Maximum number of items to include in digest'
    }
  },

  // Timezone for scheduling
  timezone: {
    type: String,
    default: 'Asia/Kolkata', // ✅ Default IST for all new users
    description: 'User timezone for scheduling notifications'
  },

  // Language preference for notifications
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'],
    description: 'Language for notification content'
  },

  // Due date reminder preferences
  due_date_reminders: {
    enabled: {
      type: Boolean,
      default: true,
      description: 'Whether due date reminders are enabled'
    },
    days_before_due: {
      type: [Number],
      default: [3, 1],
      description: 'Array of days before due date to send reminders (e.g. [7, 3, 1])'
    },
    reminder_time: {
      type: String,
      default: '09:00',
      description: 'Time of day to send reminders (HH:MM format)'
    }
  }

}, {
  timestamps: true,
  collection: 'notification_settings'
});

// Index - remove duplicate since unique: true already creates index

// Instance methods
notificationSettingsSchema.methods.isChannelEnabled = function (channelType) {
  if (!this.notifications_enabled) return false;
  return this.channels[channelType]?.enabled || false;
};

notificationSettingsSchema.methods.getChannelFrequency = function (channelType) {
  return this.channels[channelType]?.frequency || NotificationFrequency.REAL_TIME;
};

notificationSettingsSchema.methods.isEventEnabled = function (eventType) {
  if (!this.notifications_enabled) return false;

  // Handle case where event_preferences is undefined or doesn't have the property
  if (!this.event_preferences) {
    console.log(`Warning: event_preferences is undefined for user ${this.user_id}, defaulting to enabled for ${eventType}`);
    return true; // Default to enabled if no preferences set
  }

  // Return the preference value, defaulting to true if the property doesn't exist
  const eventPreference = this.event_preferences[eventType];
  if (eventPreference === undefined) {
    console.log(`Warning: event preference ${eventType} not found for user ${this.user_id}, defaulting to enabled`);
    return true;
  }

  return eventPreference !== false; // Explicitly check for false
};

notificationSettingsSchema.methods.isInQuietHours = function (channelType) {
  const channel = this.channels[channelType];
  if (!channel?.quiet_hours?.enabled) return false;

  // Use user's timezone to determine current time (not server timezone)
  const userTimezone = this.timezone || 'UTC';
  let currentTime;
  try {
    // Convert current time to user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: userTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    currentTime = formatter.format(now); // "HH:MM" in user's timezone
  } catch (tzError) {
    // Fallback to server time if timezone is invalid
    console.warn(`[QuietHours] Invalid timezone '${userTimezone}' for user ${this.user_id}, falling back to server time`);
    currentTime = new Date().toTimeString().slice(0, 5);
  }

  const start = channel.quiet_hours.start;
  const end = channel.quiet_hours.end;

  // Handle cases where quiet hours span midnight
  if (start > end) {
    return currentTime >= start || currentTime <= end;
  } else {
    return currentTime >= start && currentTime <= end;
  }
};

notificationSettingsSchema.methods.shouldSendNotification = function (eventType, channelType) {
  return this.notifications_enabled &&
    this.isEventEnabled(eventType) &&
    this.isChannelEnabled(channelType) &&
    !this.isInQuietHours(channelType);
};

/**
 * Create default notification settings for a new user.
 * @param {string} userId - The user's MongoDB ID
 * @param {string} [timezone='Asia/Kolkata'] - The user's detected timezone (from browser or registration)
 */
notificationSettingsSchema.statics.createDefaultSettings = async function (userId, timezone = 'Asia/Kolkata') {
  const defaultSettings = new this({
    user_id: userId,
    timezone, // ✅ Use browser-detected or provided timezone
    notifications_enabled: true,
    channels: {
      in_app: {
        enabled: true,
        frequency: NotificationFrequency.REAL_TIME,
        quiet_hours: { enabled: false }
      },
      email: {
        enabled: false,
        frequency: NotificationFrequency.DIGEST_DAILY,
        quiet_hours: { enabled: false }
      },
      push: {
        enabled: false,
        frequency: NotificationFrequency.REAL_TIME,
        quiet_hours: { enabled: true, start: '22:00', end: '08:00' }
      },
      sms: {
        enabled: false,
        frequency: NotificationFrequency.OFF,
        quiet_hours: { enabled: true, start: '22:00', end: '08:00' }
      },
      whatsapp: {
        enabled: false,
        frequency: NotificationFrequency.REAL_TIME,
        quiet_hours: { enabled: true, start: '22:00', end: '08:00' }
      }
    },
    due_date_reminders: {
      enabled: true,
      days_before_due: [3, 1],
      reminder_time: '09:00'
    },
    event_preferences: {
      task_assigned: true,
      task_due_soon: true,
      task_due_today: true,
      task_overdue: true,
      task_completed: true,
      task_status_changed: true,
      task_reassigned: true,
      task_updated: true,
      task_commented: true,
      task_reminder: true,
      task_snoozed: true,
      task_unsnoozed: true,
      project_assigned: true,
      project_updated: true,
      project_completed: true,
      project_milestone_reached: true,
      team_member_added: true,
      team_member_removed: true,
      team_updated: true,
      system_maintenance: true,
      security_alert: true,
      feature_announcement: true
    }
  });

  try {
    return await defaultSettings.save();
  } catch (error) {
    if (error.code === 11000) {
      return await this.findOne({ user_id: userId });
    }
    throw error;
  }
};

notificationSettingsSchema.statics.getSettingsForUser = async function (userId) {
  let settings = await this.collection.findOne({ user_id: userId });

  // Get user's detected timezone from their user record (captured at registration)
  let User;
  try {
    User = mongoose.model('User');
  } catch (err) {
    // Fallback if model isn't registered yet
    const userModule = await import('./userModal.js');
    User = userModule.User;
  }
  
  const user = await User.findById(userId).select('timezone').lean();
  const detectedTimezone = user?.timezone || 'Asia/Kolkata';

  if (!settings) {
    // New user — createDefaultSettings uses detected browser timezone
    settings = await this.createDefaultSettings(userId, detectedTimezone);
  } else {
    settings = new this(settings);

    // ✅ Auto-fix: if existing user has UTC (never set), upgrade to detectedTimezone
    if (!settings.timezone || settings.timezone === 'UTC') {
      await this.findOneAndUpdate(
        { user_id: userId },
        { $set: { timezone: detectedTimezone } }
      );
      settings.timezone = detectedTimezone;
      console.log(`⏰ [SETTINGS] Auto-upgraded timezone UTC → ${detectedTimezone} for user ${userId}`);
    }

    const needsUpdate = await this.migrateSettingsIfNeeded(settings);
    if (needsUpdate) {
      const freshData = await this.collection.findOne({ user_id: userId });
      settings = new this(freshData);
    }
  }
  return settings;
};

// Migration helper to ensure all event preferences exist
notificationSettingsSchema.statics.migrateSettingsIfNeeded = async function (settings) {
  const defaultEventPreferences = {
    task_assigned: true,
    task_due_soon: true,
    task_due_today: true,
    task_overdue: true,
    task_completed: true,
    task_status_changed: true,
    task_reassigned: true,
    task_updated: true,  // ✅ FIXED: Changed from false to true
    task_commented: true,
    task_reminder: true,
    task_snoozed: true,
    task_unsnoozed: true,
    project_assigned: true,
    project_updated: true,  // ✅ FIXED: Changed from false to true
    project_completed: true,
    project_milestone_reached: true,
    team_member_added: true,
    team_member_removed: true,
    team_updated: true,  // ✅ FIXED: Changed from false to true
    system_maintenance: true,
    security_alert: true,
    feature_announcement: true  // ✅ FIXED: Changed from false to true
  };

  let needsUpdate = false;
  const updateData = {};

  // Check if event_preferences is missing or incomplete
  if (!settings.event_preferences) {
    updateData.event_preferences = defaultEventPreferences;
    needsUpdate = true;
  } else {
    // Only add MISSING event preferences - never override user's existing choices
    const missingPrefs = {};
    for (const [key, defaultValue] of Object.entries(defaultEventPreferences)) {
      if (settings.event_preferences[key] === undefined) {
        missingPrefs[`event_preferences.${key}`] = defaultValue;
        needsUpdate = true;
      }
    }
    Object.assign(updateData, missingPrefs);
  }

  if (needsUpdate) {
    console.log(`Migrating notification settings for user ${settings.user_id}`);
    await this.findOneAndUpdate(
      { user_id: settings.user_id },
      { $set: updateData },
      { new: true }
    );
  }

  return needsUpdate;
};

notificationSettingsSchema.statics.updateChannelSettings = async function (userId, channelType, channelSettings) {
  const updatePath = `channels.${channelType}`;
  return await this.findOneAndUpdate(
    { user_id: userId },
    { $set: { [updatePath]: channelSettings } },
    { new: true, upsert: true }
  );
};

notificationSettingsSchema.statics.updateEventPreferences = async function (userId, eventPreferences) {
  return await this.findOneAndUpdate(
    { user_id: userId },
    { $set: { event_preferences: eventPreferences } },
    { new: true, upsert: true }
  );
};

notificationSettingsSchema.statics.getUsersForDigest = async function (frequency, dayOfWeek = null) {
  const query = {
    notifications_enabled: true,
    $or: [
      { 'channels.email.enabled': true, 'channels.email.frequency': frequency },
      { 'channels.in_app.enabled': true, 'channels.in_app.frequency': frequency }
    ]
  };

  if (frequency === NotificationFrequency.DIGEST_WEEKLY && dayOfWeek) {
    query['digest_settings.weekly_digest_day'] = dayOfWeek;
  }

  return await this.find(query).populate('user_id', 'firstName lastName email');
};

// Virtual for full name (if needed)
notificationSettingsSchema.virtual('user', {
  ref: 'User',
  localField: 'user_id',
  foreignField: '_id',
  justOne: true
});

// Handle model recompilation
let NotificationSettings;
try {
  NotificationSettings = mongoose.model('NotificationSettings');
} catch (error) {
  NotificationSettings = mongoose.model('NotificationSettings', notificationSettingsSchema);
}

export {
  NotificationSettings,
  NotificationFrequency,
  notificationSettingsSchema
};