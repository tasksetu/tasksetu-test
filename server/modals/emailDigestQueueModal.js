import mongoose from 'mongoose';

/**
 * Email Digest Queue Schema
 * Stores queued email notifications for daily/weekly digest delivery
 * Notifications are collected here and sent in batches at the user's preferred time
 */

const DigestFrequency = {
  DAILY: 'daily',
  WEEKLY: 'weekly'
};

const DigestStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed'
};

const emailDigestQueueSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  notification_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true
  },
  frequency: {
    type: String,
    enum: Object.values(DigestFrequency),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(DigestStatus),
    default: DigestStatus.PENDING,
    index: true
  },
  // Store key notification data so we don't need to populate later
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  trigger_event: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    default: 'normal'
  },
  // Recipient info (denormalized for digest processing)
  recipient_email: {
    type: String,
    required: true
  },
  recipient_name: {
    type: String,
    default: ''
  },
  recipient_role: {
    type: String,
    default: 'user'
  },
  // Processing metadata
  sent_at: {
    type: Date,
    default: null
  },
  error_message: {
    type: String,
    default: null
  },
  queued_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes for efficient digest processing
emailDigestQueueSchema.index({ user_id: 1, status: 1, frequency: 1 });
emailDigestQueueSchema.index({ status: 1, frequency: 1, created_at: 1 });
emailDigestQueueSchema.index({ queued_at: 1 });

/**
 * Get all pending digest items for a user grouped by frequency
 */
emailDigestQueueSchema.statics.getPendingForUser = async function (userId, frequency) {
  return this.find({
    user_id: userId,
    status: DigestStatus.PENDING,
    frequency
  }).sort({ queued_at: 1 });
};

/**
 * Get all users who have pending digest items
 */
emailDigestQueueSchema.statics.getUsersWithPendingDigest = async function (frequency) {
  return this.distinct('user_id', {
    status: DigestStatus.PENDING,
    frequency
  });
};

/**
 * Mark all digest items for a user as sent
 */
emailDigestQueueSchema.statics.markUserDigestSent = async function (userId, frequency) {
  return this.updateMany(
    {
      user_id: userId,
      status: DigestStatus.PENDING,
      frequency
    },
    {
      $set: {
        status: DigestStatus.SENT,
        sent_at: new Date()
      }
    }
  );
};

/**
 * Mark all digest items for a user as failed
 */
emailDigestQueueSchema.statics.markUserDigestFailed = async function (userId, frequency, errorMessage) {
  return this.updateMany(
    {
      user_id: userId,
      status: DigestStatus.PENDING,
      frequency
    },
    {
      $set: {
        status: DigestStatus.FAILED,
        error_message: errorMessage
      }
    }
  );
};

/**
 * Cleanup old sent/failed digest items (older than 7 days)
 */
emailDigestQueueSchema.statics.cleanupOldItems = async function (olderThanDays = 7) {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    status: { $in: [DigestStatus.SENT, DigestStatus.FAILED] },
    created_at: { $lt: cutoffDate }
  });
};

// Handle model recompilation
let EmailDigestQueue;
try {
  EmailDigestQueue = mongoose.model('EmailDigestQueue');
} catch (error) {
  EmailDigestQueue = mongoose.model('EmailDigestQueue', emailDigestQueueSchema);
}

export { EmailDigestQueue, DigestFrequency, DigestStatus };
