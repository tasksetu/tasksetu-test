import mongoose from "mongoose";

// Enums as JavaScript objects
export const TriggerEvent = {
  TASK_CREATED: 'task_created',
  TASK_UPDATED: 'task_updated',
  TASK_ASSIGNED: 'task_assigned',          // ✅ NEW: task assigned to a user (all task types)
  TASK_OVERDUE: 'task_overdue',
  TASK_COMPLETED: 'task_completed',
  TASK_REASSIGNED: 'task_reassigned',
  SUBTASK_ADDED: 'subtask_added',
  SUBTASK_COMPLETED: 'subtask_completed',
  RECURRING_INSTANCE_CREATED: 'recurring_instance_created',
  QUICK_TASK_COMPLETED: 'quick_task_completed',
  QUICK_TASK_CONVERTED: 'quick_task_converted',
  APPROVAL_REQUESTED: 'approval_requested',
  APPROVAL_APPROVED: 'approval_approved',
  APPROVAL_DENIED: 'approval_denied',
  TASK_REMINDER: 'task_reminder',
  TASK_DUE_TODAY: 'task_due_today',
  TASK_DUE_SOON: 'task_due_soon',
  USER_MENTIONED: 'user_mentioned',
  COMMENT_ADDED: 'comment_added',
  FILE_UPLOADED: 'file_uploaded',
  FILE_EDITED: 'file_edited',
  MILESTONE_ACHIEVED: 'milestone_achieved',
  MILESTONE_MISSED: 'milestone_missed',
  OVERDUE_ESCALATION: 'overdue_escalation',
  CRITICAL_ESCALATION: 'critical_escalation',
  TASK_SNOOZED: 'task_snoozed',
  TASK_UNSNOOZED: 'task_unsnoozed',
  FORM_PUBLISHED: 'form_published',
  FORM_SUBMITTED: 'form_submitted',
  SYSTEM_MAINTENANCE: 'system_maintenance', // ✅ NEW: referenced in notificationService but was missing
  SECURITY_ALERT: 'security_alert',         // ✅ NEW: referenced in notificationService but was missing
  LICENSE_EXPIRY_REMINDER: 'license_expiry_reminder', // ✅ NEW: license expiry warnings
  SYSTEM_TEST: 'system_test'
};

export const EntityType = {
  TASK: 'task',
  SUBTASK: 'subtask',
  QUICK_TASK: 'quick_task',
  APPROVAL: 'approval',
  COMMENT: 'comment',
  ATTACHMENT: 'attachment',
  MILESTONE: 'milestone',
  FORM: 'form',
  SYSTEM: 'system'
};

export const NotificationPriority = {
  URGENT: 'urgent',
  NORMAL: 'normal'
};

export const ChannelType = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
  SMS: 'sms'
};

export const ChannelStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  SUPPRESSED: 'suppressed'
};

// Channel schema for notifications
const channelSchema = new mongoose.Schema({
  channel_type: {
    type: String,
    enum: Object.values(ChannelType),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(ChannelStatus),
    default: ChannelStatus.PENDING
  },
  sent_at: {
    type: Date,
    default: null
  },
  error_message: {
    type: String,
    default: null
  },
  retry_count: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

// Related entity schema
const relatedEntitySchema = new mongoose.Schema({
  entity_type: {
    type: String,
    enum: Object.values(EntityType),
    required: true
  },
  entity_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
}, { _id: false });

// Main notification schema
const notificationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  trigger_event: {
    type: String,
    enum: Object.values(TriggerEvent),
    required: true
  },
  related_entity: {
    type: relatedEntitySchema,
    required: true
  },
  priority: {
    type: String,
    enum: Object.values(NotificationPriority),
    default: NotificationPriority.NORMAL
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  is_read: {
    type: Boolean,
    default: false
  },
  read_at: {
    type: Date,
    default: null
  },
  channels: {
    type: [channelSchema],
    default: []
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  expires_at: {
    type: Date,
    default: null
  },
  deleted_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
notificationSchema.index({ user_id: 1, is_read: 1 });
notificationSchema.index({ user_id: 1, created_at: -1 });
notificationSchema.index({ 'related_entity.entity_id': 1 });
notificationSchema.index({ created_at: -1 });
notificationSchema.index({ 'channels.channel_type': 1, user_id: 1, is_read: 1 });
notificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expires_at: { $ne: null } } });

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.is_read = true;
  this.read_at = new Date();
  return this.save();
};

notificationSchema.methods.markAsUnread = function() {
  this.is_read = false;
  this.read_at = null;
  return this.save();
};

notificationSchema.methods.softDelete = function() {
  this.deleted_at = new Date();
  return this.save();
};

notificationSchema.methods.isExpired = function() {
  if (!this.expires_at) return false;
  return new Date() > this.expires_at;
};

// Static methods
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    user_id: userId,
    is_read: false,
    deleted_at: null,
    'channels.channel_type': 'in_app',
    $or: [
      { expires_at: null },
      { expires_at: { $gt: new Date() } }
    ]
  });
};

// Static method to get notifications for a user with pagination
notificationSchema.statics.getByUser = function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    priority = null,
    isRead = null,
    triggerEvent = null
  } = options;

  const query = {
    user_id: userId,
    deleted_at: null,
    'channels.channel_type': 'in_app',
    $or: [
      { expires_at: null },
      { expires_at: { $gt: new Date() } }
    ]
  };

  if (priority) query.priority = priority;
  if (isRead !== null) query.is_read = isRead;
  if (triggerEvent) query.trigger_event = triggerEvent;

  return this.find(query)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('user_id', 'firstName lastName email')
    .exec();
};

// Static method to mark multiple notifications as read
notificationSchema.statics.markMultipleAsRead = function(userId, notificationIds = []) {
  const query = {
    user_id: userId,
    deleted_at: null
  };

  if (notificationIds.length > 0) {
    query._id = { $in: notificationIds };
  } else {
    // Mark all unread notifications as read if no specific IDs provided
    query.is_read = false;
  }

  return this.updateMany(query, {
    is_read: true,
    read_at: new Date()
  });
};

// Static method to cleanup expired notifications
notificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expires_at: { $lt: new Date() }
  });
};

// Static method to get notification statistics for a user
notificationSchema.statics.getStats = function(userId) {
  return this.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
        deleted_at: null,
        $or: [
          { expires_at: null },
          { expires_at: { $gt: new Date() } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: {
            $cond: [{ $eq: ['$is_read', false] }, 1, 0]
          }
        },
        urgent: {
          $sum: {
            $cond: [{ $eq: ['$priority', NotificationPriority.URGENT] }, 1, 0]
          }
        },
        byTriggerEvent: {
          $push: '$trigger_event'
        }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        unread: 1,
        read: { $subtract: ['$total', '$unread'] },
        urgent: 1,
        normal: { $subtract: ['$total', '$urgent'] },
        triggerEventCounts: {
          $reduce: {
            input: '$byTriggerEvent',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{
                      k: '$$this',
                      v: {
                        $add: [
                          { $ifNull: [{ $objectToArray: '$$value' }, []] },
                          1
                        ]
                      }
                    }]
                  ]
                }
              ]
            }
          }
        }
      }
    }
  ]).then(results => results[0] || {
    total: 0,
    unread: 0,
    read: 0,
    urgent: 0,
    normal: 0,
    triggerEventCounts: {}
  });
};

// Pre-save middleware to set default expires_at for certain notification types
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expires_at) {
    // Set expiration for certain notification types
    const autoExpireEvents = [
      TriggerEvent.TASK_REMINDER,
      TriggerEvent.TASK_DUE_TODAY,
      TriggerEvent.TASK_DUE_SOON
    ];
    
    if (autoExpireEvents.includes(this.trigger_event)) {
      // Auto-expire after 7 days for reminder notifications
      this.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }
  next();
});

// Pre-find middleware to exclude soft-deleted notifications by default
notificationSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'count', 'countDocuments'], function() {
  if (!this.getQuery().deleted_at) {
    this.where({ deleted_at: null });
  }
});

// Handle model recompilation
let Notification;
try {
  Notification = mongoose.model("Notification");
} catch (error) {
  Notification = mongoose.model("Notification", notificationSchema);
}

export { Notification };