import mongoose, { Document, Schema, Model, ObjectId } from 'mongoose';
import { TriggerEvent } from './notification.model';

// Notification Suppression Rule Interface
export interface INotificationSuppressionRule extends Document {
  trigger_event: TriggerEvent;
  suppression_window_minutes: number;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  // Instance methods
  shouldSuppress(lastNotificationTime: Date): boolean;
}

// Static methods interface
export interface INotificationSuppressionRuleModel extends Model<INotificationSuppressionRule> {
  // Add any static methods here if needed in the future
}

// Mongoose Schema Definition
const notificationSuppressionRuleSchema = new Schema<INotificationSuppressionRule>({
  trigger_event: {
    type: String,
    enum: Object.values(TriggerEvent),
    required: true,
    unique: true,
    index: true
  },
  suppression_window_minutes: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: false
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Instance Methods
notificationSuppressionRuleSchema.methods.shouldSuppress = function(
  lastNotificationTime: Date
): boolean {
  if (!this.is_active) {
    return false; // Rule is not active, don't suppress
  }

  const currentTime = new Date();
  const timeDifference = currentTime.getTime() - lastNotificationTime.getTime();
  const timeDifferenceMinutes = timeDifference / (1000 * 60); // Convert to minutes

  return timeDifferenceMinutes < this.suppression_window_minutes;
};

// Create indexes
notificationSuppressionRuleSchema.index({ trigger_event: 1 }, { unique: true });
notificationSuppressionRuleSchema.index({ is_active: 1 });

// Handle model recompilation for development
let NotificationSuppressionRule: INotificationSuppressionRuleModel;

try {
  NotificationSuppressionRule = mongoose.model<INotificationSuppressionRule, INotificationSuppressionRuleModel>('NotificationSuppressionRule');
} catch (error) {
  NotificationSuppressionRule = mongoose.model<INotificationSuppressionRule, INotificationSuppressionRuleModel>(
    'NotificationSuppressionRule',
    notificationSuppressionRuleSchema
  );
}

export { NotificationSuppressionRule };
export default NotificationSuppressionRule;