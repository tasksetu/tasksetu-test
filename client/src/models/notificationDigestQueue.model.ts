import mongoose, { Document, Schema, Model, ObjectId } from 'mongoose';
import { DigestFrequency } from './userNotificationPreference.model';

// Digest Status Enum
export enum DigestStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed'
}

// Notification Digest Queue Interface
export interface INotificationDigestQueue extends Document {
  user_id: ObjectId;
  notification_ids: ObjectId[];
  frequency: DigestFrequency;
  scheduled_for: Date;
  sent_at?: Date;
  status: DigestStatus;
  error_message?: string;
  created_at: Date;
  updated_at: Date;

  // Instance methods
  addNotification(notificationId: ObjectId): Promise<INotificationDigestQueue>;
  markAsSent(): Promise<INotificationDigestQueue>;
}

// Static methods interface
export interface INotificationDigestQueueModel extends Model<INotificationDigestQueue> {
  // Add any static methods here if needed in the future
}

// Mongoose Schema Definition
const notificationDigestQueueSchema = new Schema<INotificationDigestQueue>({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  notification_ids: [{
    type: Schema.Types.ObjectId,
    ref: 'Notification',
    required: true
  }],
  frequency: {
    type: String,
    enum: [
      DigestFrequency.HOURLY,
      DigestFrequency.DAILY,
      DigestFrequency.WEEKLY
    ], // Exclude IMMEDIATE as per requirement
    required: true
  },
  scheduled_for: {
    type: Date,
    required: true,
    index: true
  },
  sent_at: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: Object.values(DigestStatus),
    default: DigestStatus.PENDING,
    index: true
  },
  error_message: {
    type: String,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Instance Methods
notificationDigestQueueSchema.methods.addNotification = async function(
  notificationId: ObjectId
): Promise<INotificationDigestQueue> {
  // Only add if not already in the list
  if (!this.notification_ids.includes(notificationId)) {
    this.notification_ids.push(notificationId);
    return await this.save();
  }
  return await this.save();
};

notificationDigestQueueSchema.methods.markAsSent = async function(): Promise<INotificationDigestQueue> {
  this.status = DigestStatus.SENT;
  this.sent_at = new Date();
  this.error_message = null; // Clear any previous error
  return await this.save();
};

// Create indexes
notificationDigestQueueSchema.index({ user_id: 1 });
notificationDigestQueueSchema.index({ scheduled_for: 1 });
notificationDigestQueueSchema.index({ status: 1 });

// Compound index as specified
notificationDigestQueueSchema.index({ 
  user_id: 1, 
  scheduled_for: 1, 
  status: 1 
});

// Handle model recompilation for development
let NotificationDigestQueue: INotificationDigestQueueModel;

try {
  NotificationDigestQueue = mongoose.model<INotificationDigestQueue, INotificationDigestQueueModel>('NotificationDigestQueue');
} catch (error) {
  NotificationDigestQueue = mongoose.model<INotificationDigestQueue, INotificationDigestQueueModel>(
    'NotificationDigestQueue',
    notificationDigestQueueSchema
  );
}

export { NotificationDigestQueue };
export default NotificationDigestQueue;